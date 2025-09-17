import React, { useState, useRef, useEffect } from 'react';
import { Settings, Clock, Search, Maximize2, Move, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromptHistoryStore } from '@/ui/store/promptHistoryStore';
import { useConnectionStore } from '@/ui/store/connectionStore';
import { globalWebSocketService } from '@/infrastructure/websocket/GlobalWebSocketService';
import TriggerWordSelector from './TriggerWordSelector';
import { SettingsDropdown } from './SettingsDropdown';


interface FloatingControlsPanelProps {
  onRandomizeSeeds?: (isForceRandomize: boolean) => void;
  onShowGroupModer?: () => void;
  onShowWorkflowSnapshots?: () => void;
  onSearchNode?: (nodeId: string) => void;
  onZoomFit?: () => void;
  onShowWorkflowJson?: () => void;
  onShowObjectInfo?: () => void;
  onRefreshWorkflow?: () => void;
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
  onZoomFit,
  onShowWorkflowJson,
  onShowObjectInfo,
  onRefreshWorkflow,
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
  const [isTriggerWordSelectorOpen, setIsTriggerWordSelectorOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { openPromptHistory } = usePromptHistoryStore();
  const { url: serverUrl } = useConnectionStore();

  // Subscribe to execution events from GlobalWebSocketService - using App.tsx pattern
  useEffect(() => {
    // 🎯 Check current execution state from persistent buffer (works for navigation & refresh)
    setTimeout(() => {
      const currentState = globalWebSocketService.getCurrentExecutionState();
      
      console.log(`🎯 [FloatingControlsPanel] Current execution state from buffer:`, currentState);
      
      if (currentState.isExecuting) {
        setIsExecuting(true);
        
        console.log(`🎯 [FloatingControlsPanel] Applied execution state from persistent buffer:`, {
          isExecuting: currentState.isExecuting,
          promptId: currentState.currentPromptId?.substring(0, 8),
          nodeId: currentState.executingNodeId
        });
      } else {
        setIsExecuting(false);
        console.log(`🎯 [FloatingControlsPanel] No active execution found in buffer`);
      }
    }, 100); // Later than ExecutionProgressBar to ensure consistency
    const handleExecuting = (event: any) => {
      console.log('🚀 [FloatingControlsPanel] Raw executing event:', event);
      const { data } = event;
      
      if (data.node === null) {
        // Execution completed
        console.log('🏁 [FloatingControlsPanel] Execution completed');
        setIsExecuting(false);
      } else if (data.node) {
        // Node execution started
        console.log('🚀 [FloatingControlsPanel] Node execution started:', data.node, 'prompt_id:', data.prompt_id || 'not provided');
        setIsExecuting(true);
      }
    };

    const handleExecutionSuccess = (event: any) => {
      console.log('🏁 [FloatingControlsPanel] Execution success');
      
      setIsExecuting(false);
    };

    const handleExecutionError = (event: any) => {
      console.log('❌ [FloatingControlsPanel] Execution error');
      
      setIsExecuting(false);
    };

    const handleExecutionInterrupted = (event: any) => {
      console.log('⚠️ [FloatingControlsPanel] Execution interrupted');
      
      setIsExecuting(false);
    };

    // Handle progress_state messages to match ExecutionProgressBar behavior
    const handleProgressState = (event: any) => {
      console.log('📊 [FloatingControlsPanel] Progress state event:', event);
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
        
        console.log('📊 [FloatingControlsPanel] Updated execution state:', {
          hasRunningNodes,
          isExecuting: hasRunningNodes
        });
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
      
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsSearchOpen(false);
        setSearchValue('');
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
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim() && onSearchNode) {
      onSearchNode(searchValue.trim());
      setIsSearchOpen(false);
      setSearchValue('');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchValue('');
    }
  };

  return (
    <div 
      key={`floating-controls-${isExecuting ? 'executing' : 'idle'}`} // Force re-render on state change
      className="fixed right-4 z-40 pwa-header"
      style={{
        top: isExecuting ? '175px' : '87px'
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
            
            {/* Expandable Search Input */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0, x: 10 }}
                  animate={{ opacity: 1, width: 120, x: 0 }}
                  exit={{ opacity: 0, width: 0, x: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-0 right-full mr-2 h-8"
                >
                  <form onSubmit={handleSearchSubmit} className="h-full">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Node ID..."
                      className="w-full h-full px-2 text-sm bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-600/60 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* Trigger Word Selector Modal */}
      <TriggerWordSelector
        isOpen={isTriggerWordSelectorOpen}
        onClose={() => setIsTriggerWordSelectorOpen(false)}
        serverUrl={serverUrl || 'http://localhost:8188'}
      />
    </div>
  );
};