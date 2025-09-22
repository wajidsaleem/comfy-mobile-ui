import React, { useState, useRef, useEffect } from 'react';
import { Settings, Clock, Search, Maximize2, Move, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromptHistoryStore } from '@/ui/store/promptHistoryStore';
import { useConnectionStore } from '@/ui/store/connectionStore';
import { globalWebSocketService } from '@/infrastructure/websocket/GlobalWebSocketService';
import TriggerWordSelector from './TriggerWordSelector';
import { SettingsDropdown } from './SettingsDropdown';


interface SearchableNode {
  id: number;
  type: string;
  title?: string;
}

interface FloatingControlsPanelProps {
  onRandomizeSeeds?: (isForceRandomize: boolean) => void;
  onShowGroupModer?: () => void;
  onShowWorkflowSnapshots?: () => void;
  onSearchNode?: (nodeId: string) => void;
  onNavigateToNode?: (nodeId: number) => void;
  onSelectNode?: (node: any) => void;
  onOpenNodePanel?: () => void;
  onZoomFit?: () => void;
  onShowWorkflowJson?: () => void;
  onShowObjectInfo?: () => void;
  onRefreshWorkflow?: () => void;
  // Node search enhancement
  nodes?: SearchableNode[];
  nodeBounds?: Map<number, any>;
  // Repositioning mode controls (for passing to SettingsDropdown)
  repositionMode?: {
    isActive: boolean;
  };
  onToggleRepositionMode?: () => void;
  // Connection mode controls (for passing to SettingsDropdown)
  connectionMode?: {
    isActive: boolean;
  };
  onToggleConnectionMode?: () => void;
}

export const FloatingControlsPanel: React.FC<FloatingControlsPanelProps> = ({
  onRandomizeSeeds,
  onShowGroupModer,
  onShowWorkflowSnapshots,
  onSearchNode,
  onNavigateToNode,
  onSelectNode,
  onOpenNodePanel,
  onZoomFit,
  onShowWorkflowJson,
  onShowObjectInfo,
  onRefreshWorkflow,
  nodes = [],
  nodeBounds,
  repositionMode,
  onToggleRepositionMode,
  connectionMode,
  onToggleConnectionMode,
}) => {
  const [isClearingVRAM, setIsClearingVRAM] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableNode[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [isTriggerWordSelectorOpen, setIsTriggerWordSelectorOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { openPromptHistory } = usePromptHistoryStore();
  const { url: serverUrl } = useConnectionStore();

  // Advanced search function with scoring
  const searchNodes = (query: string): SearchableNode[] => {
    if (!query.trim()) return [];

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    const scoredNodes = nodes.map((node) => {
      let totalScore = 0;

      const nodeId = String(node.id).toLowerCase();
      const nodeType = node.type.toLowerCase();
      const nodeTitle = (node.title || '').toLowerCase();

      searchTerms.forEach(term => {
        // ID exact match (highest priority)
        if (nodeId === term) {
          totalScore += 1000;
        } else if (nodeId.includes(term)) {
          totalScore += 500;
        }

        // Type matching
        if (nodeType === term) {
          totalScore += 800;
        } else if (nodeType.includes(term)) {
          totalScore += 400;
        }

        // Title matching
        if (nodeTitle === term) {
          totalScore += 600;
        } else if (nodeTitle.includes(term)) {
          totalScore += 300;
        }

        // Word boundary matches (more natural)
        const wordBoundaryRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        if (wordBoundaryRegex.test(nodeType)) {
          totalScore += 200;
        }
        if (wordBoundaryRegex.test(nodeTitle)) {
          totalScore += 150;
        }
      });

      return { ...node, score: totalScore };
    });

    return scoredNodes
      .filter(node => node.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Limit to top 10 results
  };

  // Update search results when search value changes
  useEffect(() => {
    const results = searchNodes(searchValue);
    setSearchResults(results);
    setSelectedResultIndex(-1);
  }, [searchValue, nodes]);

  // Subscribe to execution events from GlobalWebSocketService - using App.tsx pattern
  useEffect(() => {
    // 🎯 Check current execution state from persistent buffer (works for navigation & refresh)
    setTimeout(() => {
      const currentState = globalWebSocketService.getCurrentExecutionState();                  
      if (currentState.isExecuting) {
        setIsExecuting(true);
      } else {
        setIsExecuting(false);
      }
    }, 100); // Later than ExecutionProgressBar to ensure consistency
    const handleExecuting = (event: any) => {      
      const { data } = event;      
      if (data.node === null) {
        // Execution completed
        setIsExecuting(false);
      } else if (data.node) {
        // Node execution started
        setIsExecuting(true);
      }
    };

    const handleExecutionSuccess = (event: any) => {
      setIsExecuting(false);
    };

    const handleExecutionError = (event: any) => {    
      setIsExecuting(false);
    };

    const handleExecutionInterrupted = (event: any) => {
      setIsExecuting(false);
    };

    // Handle progress_state messages to match ExecutionProgressBar behavior
    const handleProgressState = (event: any) => {
      const { data } = event;
      
      if (data.nodes) {
        const nodes = data.nodes;
        let hasRunningNodes = false;
        
        // Check if any node is in running state
        Object.keys(nodes).forEach(nodeId => {
          const nodeData = nodes[nodeId];
          if (nodeData.state === 'running') {
            hasRunningNodes = true;
          }
        });
        
        // Update execution state based on running nodes
        setIsExecuting(hasRunningNodes);
      }
    };

    // ✅ Subscribe to raw ComfyUI events
    const listenerIds = [
      globalWebSocketService.on('executing', handleExecuting),
      globalWebSocketService.on('execution_success', handleExecutionSuccess),
      globalWebSocketService.on('execution_error', handleExecutionError),
      globalWebSocketService.on('execution_interrupted', handleExecutionInterrupted),
      globalWebSocketService.on('progress_state', handleProgressState)
    ];

    return () => {
      // Cleanup event listeners using IDs
      globalWebSocketService.offById('executing', listenerIds[0]);
      globalWebSocketService.offById('execution_success', listenerIds[1]);
      globalWebSocketService.offById('execution_error', listenerIds[2]);
      globalWebSocketService.offById('execution_interrupted', listenerIds[3]);
      globalWebSocketService.offById('progress_state', listenerIds[4]);
    };
  }, []); // No dependencies needed

  // Close dropdowns when clicking/touching outside
  useEffect(() => {
    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Check if click is outside both settings button AND settings dropdown
      const isOutsideSettings = settingsRef.current && !settingsRef.current.contains(target);
      const isOutsideDropdown = settingsDropdownRef.current && !settingsDropdownRef.current.contains(target);

      if (isOutsideSettings && isOutsideDropdown) {
        setIsSettingsOpen(false);
      }

      // For search, check both the search button and the search panel
      const isOutsideSearchButton = searchRef.current && !searchRef.current.contains(target);
      const searchPanel = document.querySelector('[data-search-panel]');
      const isOutsideSearchPanel = searchPanel && !searchPanel.contains(target);

      if (isOutsideSearchButton && isOutsideSearchPanel) {
        setIsSearchOpen(false);
        setSearchValue('');
        setSearchResults([]);
        setSelectedResultIndex(-1);
      }
    };

    if (isSettingsOpen || isSearchOpen) {
      // Add both mouse and touch event listeners for better mobile support
      document.addEventListener('mousedown', handleOutsideInteraction);
      document.addEventListener('touchstart', handleOutsideInteraction);

      return () => {
        document.removeEventListener('mousedown', handleOutsideInteraction);
        document.removeEventListener('touchstart', handleOutsideInteraction);
      };
    }
  }, [isSettingsOpen, isSearchOpen]);

  // Focus search input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleClearVRAM = async () => {
    setIsClearingVRAM(true);
    try {
      const ComfyUIService = (await import('@/infrastructure/api/ComfyApiClient')).default;
      const success = await ComfyUIService.clearVRAM();
      
      if (success) {
        const { toast } = await import('sonner');
        toast.success('VRAM Cleared', {
          description: 'Video memory has been successfully cleared',
          duration: 3000,
        });
      } else {
        const { toast } = await import('sonner');
        toast.error('Failed to Clear VRAM', {
          description: 'Could not clear video memory. Please check the server connection.',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error clearing VRAM:', error);
      const { toast } = await import('sonner');
      toast.error('Error', {
        description: 'An error occurred while clearing VRAM',
        duration: 5000,
      });
    } finally {
      setIsClearingVRAM(false);
      setIsSettingsOpen(false);
    }
  };



  const handleShowWorkflowSnapshots = () => {
    if (onShowWorkflowSnapshots) {
      onShowWorkflowSnapshots();
      setIsSettingsOpen(false);
    }
  };

  const handleShowGroupModer = () => {
    if (onShowGroupModer) {
      onShowGroupModer();
      setIsSettingsOpen(false);
    }
  };

  const handleShowPromptHistory = () => {
    openPromptHistory();
    setIsSettingsOpen(false);
  };

  const handleShowWorkflowJson = () => {
    if (onShowWorkflowJson) {
      onShowWorkflowJson();
      setIsSettingsOpen(false);
    }
  };

  const handleShowObjectInfo = () => {
    if (onShowObjectInfo) {
      onShowObjectInfo();
      setIsSettingsOpen(false);
    }
  };

  const handleShowTriggerWordSelector = () => {
    setIsTriggerWordSelectorOpen(true);
    setIsSettingsOpen(false);
  };

  const handleSearchToggle = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      setSearchValue('');
      setSearchResults([]);
      setSelectedResultIndex(-1);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If there are search results and one is selected, navigate to it
    if (searchResults.length > 0) {
      const targetIndex = selectedResultIndex >= 0 ? selectedResultIndex : 0;
      const targetNode = searchResults[targetIndex];
      if (onNavigateToNode) {
        onNavigateToNode(targetNode.id);
        setIsSearchOpen(false);
        setSearchValue('');
        setSearchResults([]);
        setSelectedResultIndex(-1);
        return;
      }
    }

    // Fallback to original behavior for backward compatibility
    if (searchValue.trim() && onSearchNode) {
      onSearchNode(searchValue.trim());
      setIsSearchOpen(false);
      setSearchValue('');
      setSearchResults([]);
      setSelectedResultIndex(-1);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchValue('');
      setSearchResults([]);
      setSelectedResultIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev =>
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
    }
  };

  const handleResultSelect = (node: SearchableNode) => {
    if (onNavigateToNode) {
      onNavigateToNode(node.id);

      // Find and select the node (same pattern as NodeParameterEditor)
      if (onSelectNode && nodeBounds) {
        console.log('🔍 [FloatingControlsPanel] Searching for node:', node.id);
        console.log('🔍 [FloatingControlsPanel] Available nodeBounds:', Array.from(nodeBounds.keys()));

        const nodeBound = nodeBounds.get(node.id);
        console.log('🔍 [FloatingControlsPanel] Found nodeBound:', nodeBound);

        const targetNode = nodeBound?.node;
        console.log('🔍 [FloatingControlsPanel] Target node:', targetNode);

        if (targetNode) {
          console.log('🔍 [FloatingControlsPanel] Will select node after 300ms delay');
          setTimeout(() => {
            console.log('🔍 [FloatingControlsPanel] Selecting node now:', targetNode);
            onSelectNode(targetNode);

            // Open NodeInspector panel
            if (onOpenNodePanel) {
              console.log('🔍 [FloatingControlsPanel] Opening NodeInspector panel');
              onOpenNodePanel();
            }
          }, 300); // Wait for animation to center the node first
        } else {
          console.warn('🚨 [FloatingControlsPanel] Node not found in nodeBounds');
        }
      } else {
        console.warn('🚨 [FloatingControlsPanel] Missing onSelectNode or nodeBounds');
      }

      setIsSearchOpen(false);
      setSearchValue('');
      setSearchResults([]);
      setSelectedResultIndex(-1);
    }
  };

  return (
    <div 
      key={`floating-controls-${isExecuting ? 'executing' : 'idle'}`} // Force re-render on state change
      className="fixed right-4 z-40 pwa-header"
      style={{
        top: isExecuting ? '195px' : '107px'
      }}
    >
      <div className="bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/25 border border-white/20 dark:border-slate-600/20 p-2 relative">
        {/* Gradient Overlay for Enhanced Glass Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none rounded-xl" />
        {/* Workflow Controls Container */}
        <div className="flex items-center space-x-1 relative z-10">

          {/* Search Node Button */}
          <div className="relative" ref={searchRef}>
            <Button
              onClick={handleSearchToggle}
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 hover:bg-white/60 dark:hover:bg-slate-700/60 ${
                isSearchOpen ? 'bg-white/60 dark:bg-slate-700/60' : ''
              }`}
              title="Search Node"
            >
              <Search className="h-4 w-4" />
            </Button>
            
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Refresh Workflow Button */}
          {onRefreshWorkflow && (
            <Button
              onClick={onRefreshWorkflow}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-white/60 dark:hover:bg-slate-700/60"
              title="Refresh Workflow Slots"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Fit to Screen Button */}
          {onZoomFit && (
            <>
              <Button
                onClick={onZoomFit}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-white/60 dark:hover:bg-slate-700/60"
                title="Fit to screen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>                            
            </>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Queue Button */}
          <Button
            onClick={handleShowPromptHistory}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-white/60 dark:hover:bg-slate-700/60"
            title="Queue"
          >
            <Clock className="h-4 w-4" />
          </Button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Settings Button with Dropdown */}
          <div className="relative" ref={settingsRef}>
            <Button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 transition-transform duration-200 hover:bg-white/60 dark:hover:bg-slate-700/60 ${
                isSettingsOpen ? 'rotate-90' : ''
              }`}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
          </div>
        </div>
      </div>


      {/* Settings Dropdown - Outside parent container to avoid backdrop-filter conflict */}
      <SettingsDropdown
        ref={settingsDropdownRef}
        isOpen={isSettingsOpen}
        isClearingVRAM={isClearingVRAM}
        isExecuting={isExecuting}
        onShowGroupModer={handleShowGroupModer}
        onRandomizeSeeds={onRandomizeSeeds}
        onShowTriggerWordSelector={handleShowTriggerWordSelector}
        onShowWorkflowJson={handleShowWorkflowJson}
        onShowObjectInfo={handleShowObjectInfo}
        onShowWorkflowSnapshots={handleShowWorkflowSnapshots}
        onClearVRAM={handleClearVRAM}
        repositionMode={repositionMode}
        onToggleRepositionMode={onToggleRepositionMode}
        connectionMode={connectionMode}
        onToggleConnectionMode={onToggleConnectionMode}
      />

      {/* Search Panel - Independent container below main controls */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full mt-2 right-0 w-80 bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/25 border border-white/20 dark:border-slate-600/20 p-3 z-50"
            data-search-panel
            style={{
              touchAction: 'pan-y pinch-zoom',
              overscrollBehaviorY: 'contain'
            } as React.CSSProperties}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none rounded-xl" />

            <div className="relative z-10">
              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="mb-3">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search nodes by ID, type, or title..."
                  className="w-full px-3 py-2 text-sm bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-600/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </form>

              {/* Search Results */}
              {searchValue.trim() && searchResults.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </div>
                  <div
                    className="max-h-48 overflow-y-auto space-y-1 pr-1"
                    style={{
                      touchAction: 'pan-y pinch-zoom',
                      overscrollBehaviorY: 'contain'
                    } as React.CSSProperties}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                    }}
                    onWheel={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {searchResults.map((node, index) => (
                      <button
                        key={node.id}
                        onClick={() => handleResultSelect(node)}
                        className={`w-full text-left p-2 rounded-md transition-colors ${
                          index === selectedResultIndex
                            ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                            : 'hover:bg-white/40 dark:hover:bg-slate-700/50 bg-white/20 dark:bg-slate-800/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {node.title || node.type}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
                              ID: {node.id} • Type: {node.type}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                            #{node.id}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Message */}
              {searchValue.trim() && searchResults.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">
                  No nodes found for "{searchValue}"
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger Word Selector Modal */}
      <TriggerWordSelector
        isOpen={isTriggerWordSelectorOpen}
        onClose={() => setIsTriggerWordSelectorOpen(false)}
        serverUrl={serverUrl || 'http://localhost:8188'}
      />
    </div>
  );
};