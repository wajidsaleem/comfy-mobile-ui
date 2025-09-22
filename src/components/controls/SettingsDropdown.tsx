import React, { forwardRef } from 'react';
import { Loader2, Dices, Users, FileJson, Database, Hash, Camera, Brush, Move, Link } from 'lucide-react';

interface SettingsDropdownProps {
  isOpen: boolean;
  isClearingVRAM: boolean;
  isExecuting: boolean; // Add execution state for dynamic positioning
  onShowGroupModer?: () => void;
  onRandomizeSeeds?: (isForceRandomize: boolean) => void;
  onShowTriggerWordSelector: () => void;
  onShowWorkflowJson?: () => void;
  onShowObjectInfo?: () => void;
  onShowWorkflowSnapshots?: () => void;
  onClearVRAM: () => void;
  // Repositioning mode controls
  repositionMode?: {
    isActive: boolean;
  };
  onToggleRepositionMode?: () => void;
  // Connection mode controls
  connectionMode?: {
    isActive: boolean;
  };
  onToggleConnectionMode?: () => void;
}

export const SettingsDropdown = forwardRef<HTMLDivElement, SettingsDropdownProps>(({
  isOpen,
  isClearingVRAM,
  isExecuting,
  onShowGroupModer,
  onRandomizeSeeds,
  onShowTriggerWordSelector,
  onShowWorkflowJson,
  onShowObjectInfo,
  onShowWorkflowSnapshots,
  onClearVRAM,
  repositionMode,
  onToggleRepositionMode,
  connectionMode,
  onToggleConnectionMode,
}, ref) => {
  if (!isOpen) return null;

  return (
    <div 
      ref={ref} 
      className="fixed right-4 w-60 z-50 pwa-header" 
      style={{
        top: isExecuting ? '254px' : '168px'
      }}
    >
      {/* Glassmorphism container - EXACTLY like QuickActionPanel */}
      <div className="bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/25 border border-white/20 dark:border-slate-600/20 p-2 relative overflow-hidden">
        {/* Gradient Overlay for Enhanced Glass Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none" />
        
        {/* Content container - EXACTLY like QuickActionPanel */}
        <div className="relative z-10">
          {/* Group 1: Workflow Tools */}
          {(onShowGroupModer || onRandomizeSeeds || onToggleRepositionMode || onToggleConnectionMode) && (
            <>
              {/* Group Title */}
              <div className="px-4 py-2 bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-b border-white/10 dark:border-slate-600/10 rounded-t-xl">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Workflow Tools
                </h3>
              </div>
              
              {/* Fast Group Moder Button */}
              {onShowGroupModer && (
                <button
                  onClick={onShowGroupModer}
                  className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <Users className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    Fast Group Moder
                  </span>
                </button>
              )}

              {/* Trigger Word Selector */}
              <button
                onClick={onShowTriggerWordSelector}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
              >
                <Hash className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                  Trigger Words
                </span>
              </button>

              {/* Randomize Seeds Button */}
              {onRandomizeSeeds && (
                <button
                  onClick={() => onRandomizeSeeds(true)}
                  className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <Dices className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    Randomize Seeds
                  </span>
                </button>
              )}

              {/* Node Repositioning Button */}
              {onToggleRepositionMode && (
                <button
                  onClick={onToggleRepositionMode}
                  className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors ${
                    repositionMode?.isActive 
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                      : ''
                  }`}
                >
                  <Move className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    Node Repositioning
                  </span>
                </button>
              )}

              {/* Node Connection Button */}
              {onToggleConnectionMode && (
                <button
                  onClick={onToggleConnectionMode}
                  className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors ${
                    connectionMode?.isActive 
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                      : ''
                  }`}
                >
                  <Link className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    Node Connection
                  </span>
                </button>
              )}
            </>
          )}
          
          {/* Group 2: Workflow Information */}
          {(onShowWorkflowJson || onShowObjectInfo) && (
            <>
              {/* Group Title */}
              <div className="px-4 py-2 bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-b border-white/10 dark:border-slate-600/10">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Workflow Info
                </h3>
              </div>

              {/* Workflow JSON Viewer */}
              {onShowWorkflowJson && (
                <button
                  onClick={onShowWorkflowJson}
                  className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <FileJson className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    View Workflow JSON
                  </span>
                </button>
              )}

              {/* Object Info Viewer */}
              {onShowObjectInfo && (
                <button
                  onClick={onShowObjectInfo}
                  className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <Database className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                    View Object Info
                  </span>
                </button>
              )}
            </>
          )}
          
          {/* Group 3: System Controls */}
          <>
            {/* Group Title */}
            <div className="px-4 py-2 bg-white/10 dark:bg-slate-700/10 backdrop-blur-sm border-b border-white/10 dark:border-slate-600/10">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                System
              </h3>
            </div>
            
            {/* Workflow Snapshots Option */}
            {onShowWorkflowSnapshots && (
              <button
                onClick={onShowWorkflowSnapshots}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-colors"
              >
                <Camera className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-left flex-1">
                  Workflow Snapshots
                </span>
              </button>
            )}
            
            <button
              onClick={onClearVRAM}
              disabled={isClearingVRAM}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-red-500/20 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearingVRAM ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400 flex-shrink-0" />
              ) : (
                <Brush className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium text-red-700 dark:text-red-300 text-left flex-1">
                {isClearingVRAM ? 'Clearing...' : 'Clear VRAM'}
              </span>
            </button>
          </>
        </div>
      </div>
    </div>
  );
});