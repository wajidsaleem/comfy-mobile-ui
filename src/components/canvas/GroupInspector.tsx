import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NodeMode } from '@/shared/types/app/base';
import { Eye, EyeOff, Play, Square } from 'lucide-react';

interface GroupInspectorProps {
  selectedNode: any;
  isVisible: boolean;
  onClose: () => void;
  onNavigateToNode: (nodeId: number) => void;
  onSelectNode: (node: any) => void;
  onNodeModeChange: (nodeId: number, mode: number) => void;
  getNodeMode: (nodeId: number, originalMode: number) => number;
}

export const GroupInspector: React.FC<GroupInspectorProps> = ({
  selectedNode,
  isVisible,
  onClose,
  onNavigateToNode,
  onSelectNode,
  onNodeModeChange,
  getNodeMode,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  if (!selectedNode.groupInfo) {
    return null;
  }

  const { groupInfo } = selectedNode;

  // Style and Icon for each mode
  const getModeConfig = (mode: number) => {
    switch (mode) {
      case NodeMode.ALWAYS:
        return {
          label: 'Always',
          color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-400/30',
          icon: <Play className="w-3 h-3" />
        };
      case NodeMode.NEVER:
        return {
          label: 'Mute',
          color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/30',
          icon: <Square className="w-3 h-3" />
        };
      case NodeMode.BYPASS:
        return {
          label: 'Bypass',
          color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400/30',
          icon: <EyeOff className="w-3 h-3" />
        };
      default:
        return {
          label: 'Always',
          color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-400/30',
          icon: <Play className="w-3 h-3" />
        };
    }
  };

  // Set all nodes to a specific mode
  const setAllNodesMode = (mode: number) => {
    groupInfo.nodeIds.forEach((nodeId: number) => {
      onNodeModeChange(nodeId, mode);
    });
  };

  // Toggle node mode (Always → Mute → Bypass → Always)
  const toggleNodeMode = (nodeId: number, currentMode: number) => {
    let nextMode: number;
    switch (currentMode) {
      case NodeMode.ALWAYS:
        nextMode = NodeMode.NEVER; // Always → Mute
        break;
      case NodeMode.NEVER:
        nextMode = NodeMode.BYPASS; // Mute → Bypass
        break;
      case NodeMode.BYPASS:
        nextMode = NodeMode.ALWAYS; // Bypass → Always
        break;
      default:
        nextMode = NodeMode.ALWAYS;
        break;
    }
    onNodeModeChange(nodeId, nextMode);
  };

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 z-50 bg-white/50 backdrop-blur-md border-t border-slate-200/40 shadow-2xl dark:bg-slate-900/50 dark:border-slate-700/40 max-h-[50vh] flex flex-col transition-all duration-300 ease-out ${
        isVisible 
          ? 'transform translate-y-0 opacity-100' 
          : 'transform translate-y-full opacity-0'
      }`}
      style={{
        touchAction: 'pan-y pinch-zoom',
        overscrollBehaviorX: 'none'
      } as React.CSSProperties}
      onTouchStart={(e) => {
        // Prevent horizontal swipe gestures on the panel itself
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        const target = e.target as HTMLElement;
        
        // Allow slider interactions, but prevent other horizontal swipes
        if (!target.closest('[role="slider"]') && 
            !target.closest('[data-slider]') &&
            !target.closest('[data-radix-slider-root]')) {
          e.stopPropagation();
        }
      }}
    >
      {/* Fixed Header */}
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {groupInfo.title}
                </h3>
              </div>
              <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                <span>Group ID: {groupInfo.groupId}</span>
                <span>{groupInfo.nodeIds.length} nodes</span>
                <Badge variant="outline" className="text-xs">
                  GROUP
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Close Button */}
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <span className="text-2xl leading-none">×</span>
              </Button>
            </div>
          </div>

          {/* Batch processing buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setAllNodesMode(NodeMode.ALWAYS)}
              size="sm"
              className="bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300 border-green-400/30 dark:border-green-500/30 backdrop-blur-sm shadow-lg hover:shadow-xl font-medium"
            >
              <Play className="w-4 h-4 mr-1" />
              All Always
            </Button>
            <Button
              onClick={() => setAllNodesMode(NodeMode.NEVER)}
              size="sm"
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 border-blue-400/30 dark:border-blue-500/30 backdrop-blur-sm shadow-lg hover:shadow-xl font-medium"
            >
              <Square className="w-4 h-4 mr-1" />
              All Mute
            </Button>
            <Button
              onClick={() => setAllNodesMode(NodeMode.BYPASS)}
              size="sm"
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border-purple-400/30 dark:border-purple-500/30 backdrop-blur-sm shadow-lg hover:shadow-xl font-medium"
            >
              <EyeOff className="w-4 h-4 mr-1" />
              All Bypass
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{
          touchAction: 'pan-y pinch-zoom',
          overscrollBehaviorX: 'none'
        } as React.CSSProperties}
        onTouchStart={(e) => {
          // Prevent horizontal swipe gestures in content area
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          const target = e.target as HTMLElement;
          
          // Allow slider interactions, but prevent other horizontal swipes
          if (!target.closest('[role="slider"]') && 
              !target.closest('[data-slider]') &&
              !target.closest('[data-radix-slider-root]')) {
            e.stopPropagation();
          }
        }}
      >
        <div 
          className="max-w-4xl mx-auto"
          style={{
            touchAction: 'pan-y pinch-zoom',
            overscrollBehaviorX: 'none'
          } as React.CSSProperties}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            const target = e.target as HTMLElement;
            
            // Allow slider interactions only
            if (!target.closest('[role="slider"]') && 
                !target.closest('[data-slider]') &&
                !target.closest('[data-radix-slider-root]')) {
              e.stopPropagation();
            }
          }}
        >
          <div className="space-y-3">
            {groupInfo.nodes.map((node: any) => {
              const nodeMode = getNodeMode(node.id, node.mode || NodeMode.ALWAYS);
              const modeConfig = getModeConfig(nodeMode);

              return (
                <div 
                  key={node.id} 
                  className="p-3 rounded-lg border border-slate-200/60 bg-white/40 dark:bg-slate-800/40 dark:border-slate-700/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {node.title || node.type}
                        </h4>
                        <Badge className={`text-xs ${modeConfig.color} flex items-center space-x-1`}>
                          {modeConfig.icon}
                          <span>{modeConfig.label}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>ID: {node.id}</span>
                        <span>Type: {node.type}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Node mode toggle button (Always → Mute → Bypass → Always) */}
                      <Button
                        onClick={() => toggleNodeMode(node.id, nodeMode)}
                        size="sm"
                        variant="ghost"
                        className={`h-8 px-2 ${
                          nodeMode === NodeMode.ALWAYS 
                            ? 'text-blue-700 dark:text-blue-400 hover:bg-blue-500/10' 
                            : nodeMode === NodeMode.NEVER
                            ? 'text-purple-700 dark:text-purple-400 hover:bg-purple-500/10'
                            : 'text-green-700 dark:text-green-400 hover:bg-green-500/10'
                        }`}
                        title={
                          nodeMode === NodeMode.ALWAYS 
                            ? 'Click to Mute' 
                            : nodeMode === NodeMode.NEVER 
                            ? 'Click to Bypass'
                            : 'Click to Always'
                        }
                      >
                        {nodeMode === NodeMode.ALWAYS ? (
                          <Square className="w-4 h-4" />
                        ) : nodeMode === NodeMode.NEVER ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Node navigation button */}
                      <Button
                        onClick={() => onNavigateToNode(node.id)}
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-blue-600 dark:text-blue-400"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {/* Node selection button */}
                      <Button
                        onClick={() => onSelectNode(node)}
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-slate-600 dark:text-slate-400"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {groupInfo.nodes.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No nodes found in this group</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};