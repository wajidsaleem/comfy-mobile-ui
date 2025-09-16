import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { INodeWithMetadata } from '@/shared/types/comfy/IComfyObjectInfo';
import { ComfyGraphNode } from '@/core/domain/ComfyGraphNode';
import { NodeMode } from '@/shared/types/app/base';
import { NodeParameterEditor } from '@/components/canvas/NodeParameterEditor';
import { GroupInspector } from '@/components/canvas/GroupInspector';

interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  node: ComfyGraphNode;
}

interface EditingParam {
  nodeId: number;
  paramName: string;
}

interface UploadState {
  isUploading: boolean;
  nodeId?: number;
  paramName?: string;
  message?: string;
}

interface NodeInspectorProps {
  selectedNode: ComfyGraphNode;
  nodeMetadata: Map<number, INodeWithMetadata>;
  metadataLoading: boolean;
  metadataError: string | null;
  isNodePanelVisible: boolean;
  editingParam: EditingParam | null;
  editingValue: any;
  uploadState: UploadState;
  nodeBounds: Map<number, NodeBounds>;
  getWidgetValue: (nodeId: number, paramName: string, originalValue: any) => any;
  getNodeMode: (nodeId: number, originalMode: number) => number;
  onClose: () => void;
  onStartEditing: (nodeId: number, paramName: string, value: any) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditingValueChange: (value: any) => void;
  onControlAfterGenerateChange?: (nodeId: number, value: string) => void;
  onFilePreview: (filename: string) => void;
  onFileUpload: (nodeId: number, paramName: string) => void;
  onFileUploadDirect?: (nodeId: number, paramName: string, file: File) => void;
  onNavigateToNode: (nodeId: number) => void;
  onSelectNode: (node: ComfyGraphNode) => void;
  onNodeModeChange: (nodeId: number, mode: number) => void;
  modifiedWidgetValues: Map<number, Record<string, any>>;
  // Direct widget value setting (for bypassing edit mode)
  setWidgetValue?: (nodeId: number, paramName: string, value: any) => void;
  // Single execute functionality
  isOutputNode?: boolean;
  canSingleExecute?: boolean;
  isSingleExecuting?: boolean;
  onSingleExecute?: (nodeId: number) => void;
  // Node color change functionality
  onNodeColorChange?: (nodeId: number, bgcolor: string) => void;
  // Node deletion functionality
  onNodeDelete?: (nodeId: number) => void;
  // Node refresh functionality
  onNodeRefresh?: (nodeId: number) => void;
}

// Available node background colors (reduced similar colors)
const NODE_COLORS = [
  { name: 'Brown', value: '#593930' },
  { name: 'Teal', value: '#3f5159' },
  { name: 'Blue', value: '#29699c' },
  { name: 'Purple', value: '#335' },
  { name: 'Green', value: '#353' },
  { name: 'Red', value: '#653' },
  { name: 'Blue Gray', value: '#364254' },
  { name: 'Black', value: '#000' }
];

interface ColorPickerProps {
  selectedColor?: string;
  onColorChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorChange }) => {
  // Check if current color is in predefined colors
  const isColorInPredefined = selectedColor && NODE_COLORS.some(color => color.value === selectedColor);
  const isNoneSelected = !selectedColor || !isColorInPredefined;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Node Color:</span>
      <div className="flex flex-wrap gap-2">
        {/* Clear/None option */}
        <button
          onClick={() => onColorChange('')}
          className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center ${
            isNoneSelected
              ? 'border-blue-500 scale-105 shadow-lg bg-slate-100 dark:bg-slate-800' 
              : 'border-gray-300 dark:border-gray-600 hover:scale-105 bg-slate-50 dark:bg-slate-900'
          }`}
          title="Clear color / Default"
        >
          <span className="text-lg font-bold text-slate-600 dark:text-slate-400">×</span>
        </button>
        
        {/* Color options */}
        {NODE_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className={`w-10 h-10 rounded-lg border-2 transition-all shadow-sm ${
              selectedColor === color.value 
                ? 'border-blue-500 scale-105 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800' 
                : 'border-gray-300 dark:border-gray-600 hover:scale-105 hover:shadow-md'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
        
        {/* Show custom color indicator if selected color is not in predefined list */}
        {selectedColor && !isColorInPredefined && (
          <div
            className="w-10 h-10 rounded-lg border-2 border-orange-500 scale-105 shadow-lg ring-2 ring-orange-200 dark:ring-orange-800 relative"
            style={{ backgroundColor: selectedColor }}
            title={`Custom color: ${selectedColor}`}
          >
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full text-xs text-white flex items-center justify-center">
              <span className="text-[8px] font-bold">C</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  nodeMetadata,
  metadataLoading,
  metadataError,
  isNodePanelVisible,
  editingParam,
  editingValue,
  uploadState,
  nodeBounds,
  getWidgetValue,
  getNodeMode,
  modifiedWidgetValues,
  onClose,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditingValueChange,
  onControlAfterGenerateChange,
  onFilePreview,
  onFileUpload,
  onFileUploadDirect,
  onNavigateToNode,
  onSelectNode,
  onNodeModeChange,
  setWidgetValue,
  // Single execute props
  isOutputNode = false,
  canSingleExecute = false,
  isSingleExecuting = false,
  onSingleExecute,
  // Node color change prop
  onNodeColorChange,
  // Node deletion prop
  onNodeDelete,
  // Node refresh prop
  onNodeRefresh,
}) => {
  const nodeId = typeof selectedNode.id === 'string' ? parseInt(selectedNode.id) : selectedNode.id;
  const metadata = nodeMetadata.get(nodeId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Get current node bgcolor from selectedNode
  const currentBgColor = selectedNode.bgcolor || undefined;
  
  // Group node detection (WorkflowNode type's groupInfo property check)
  const isGroupNode = selectedNode.type === 'GROUP_NODE' && 'groupInfo' in selectedNode && selectedNode.groupInfo;

  // If it's a group node, render GroupInspector
  if (isGroupNode) {
    return (
      <GroupInspector
        selectedNode={selectedNode}
        isVisible={isNodePanelVisible}
        onClose={onClose}
        onNavigateToNode={onNavigateToNode}
        onSelectNode={onSelectNode}
        onNodeModeChange={onNodeModeChange}
        getNodeMode={getNodeMode}
      />
    );
  }

  // Create color filter based on node bgcolor
  const getColorFilter = (bgcolor?: string) => {
    if (!bgcolor) return {};
    
    // Convert hex to RGB and apply subtle overlay
    const hex = bgcolor.replace('#', '');
    let r, g, b;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return {};
    }
    
    return {
      backgroundImage: `linear-gradient(rgba(${r}, ${g}, ${b}, 0.12), rgba(${r}, ${g}, ${b}, 0.06))`,
      borderTopColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
    };
  };

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 bg-white/50 backdrop-blur-md border-t border-slate-200/40 shadow-2xl dark:bg-slate-900/50 dark:border-slate-700/40 max-h-[75vh] flex flex-col transition-all duration-300 ease-out ${
        isNodePanelVisible
          ? 'transform translate-y-0 opacity-100'
          : 'transform translate-y-full opacity-0'
      }`}
      style={{
        touchAction: 'pan-y pinch-zoom',
        overscrollBehaviorX: 'none',
        ...getColorFilter(currentBgColor)
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {metadata?.displayName || selectedNode.title || selectedNode.type}
                </h3>
              </div>
              <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                <span>ID: {nodeId}</span>
                <span>Type: {selectedNode.type}</span>
                {metadata?.category && (
                  <Badge variant="outline" className="text-xs">
                    {metadata.category}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Refresh Button */}
              {onNodeRefresh && (
                <Button
                  onClick={() => onNodeRefresh(nodeId)}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 flex-shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Refresh node input/output slots"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
              )}
              {/* Delete Button */}
              {onNodeDelete && (
                <Button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 flex-shrink-0 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
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
          
          {/* Color Picker - Full Width Row */}
          {onNodeColorChange && (
            <div className="mt-3">
              <ColorPicker
                selectedColor={currentBgColor}
                onColorChange={(color) => onNodeColorChange(nodeId, color)}
              />
            </div>
          )}
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
          <NodeParameterEditor
            selectedNode={selectedNode}
            metadata={metadata || null}
            metadataLoading={metadataLoading}
            metadataError={metadataError}
            editingParam={editingParam}
            editingValue={editingValue}
            uploadState={uploadState}
            nodeBounds={nodeBounds}
            getWidgetValue={getWidgetValue}
            getNodeMode={getNodeMode}
            modifiedWidgetValues={modifiedWidgetValues}
            onStartEditing={onStartEditing}
            onCancelEditing={onCancelEditing}
            onSaveEditing={onSaveEditing}
            onEditingValueChange={onEditingValueChange}
            onControlAfterGenerateChange={onControlAfterGenerateChange}
            onNodeModeChange={onNodeModeChange}
            onFilePreview={onFilePreview}
            onFileUpload={onFileUpload}
            onFileUploadDirect={onFileUploadDirect}
            onNavigateToNode={onNavigateToNode}
            onSelectNode={onSelectNode}
            setWidgetValue={setWidgetValue}
            // Single execute props
            isOutputNode={isOutputNode}
            canSingleExecute={canSingleExecute}
            isSingleExecuting={isSingleExecuting}
            onSingleExecute={onSingleExecute}
          />
        </div>
      </div>
      
      {/* Confirm Delete Dialog */}
      {onNodeDelete && (
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          title="Delete Node"
          message={`Are you sure you want to delete node ${nodeId} (${metadata?.displayName || selectedNode.title || selectedNode.type})? All connected links will also be removed.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="destructive"
          onConfirm={() => onNodeDelete(nodeId)}
          onCancel={() => {}}
          onClose={() => setIsDeleteDialogOpen(false)}
        />
      )}
    </div>
  );
};