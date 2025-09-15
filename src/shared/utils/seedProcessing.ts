import { IComfyWorkflow } from '@/shared/types/app/IComfyWorkflow';
import { INodeWithMetadata } from '@/shared/types/comfy/IComfyObjectInfo';
import { getControlAfterGenerate } from '@/shared/utils/workflowMetadata';

// Type definitions for seed processing
export interface NodeSeedControl {
  nodeId: number;
  controlValue: string;
}

export interface NodeSeedValue {
  name: string;
  value: any;
}

export interface SeedParameterIndex {
  name: string;
  index: number;
}

export interface SeedChange {
  nodeId: number;
  paramName: string;
  oldValue: any;
  newValue: any;
  controlValue: string;
}

// Widget editor interface for dependency injection
export interface WidgetEditor {
  getWidgetValue: (nodeId: number, paramName: string, defaultValue: any) => any;
  setWidgetValue: (nodeId: number, paramName: string, value: any) => void;
}

/**
 * Get nodes with control_after_generate parameter
 * @param workflow - Current workflow
 * @param nodeMetadata - Node metadata map
 * @param widgetEditor - Widget editor instance
 * @returns Array of nodes with seed control
 */
export function getNodesWithSeedControl(
  workflow: IComfyWorkflow | null,
  nodeMetadata: Map<number, INodeWithMetadata> | null,
  widgetEditor: WidgetEditor
): NodeSeedControl[] {
    console.log('🔍 getNodesWithSeedControl - Input validation:', {
      hasWorkflow: !!workflow,
      hasWorkflowJson: !!workflow?.workflow_json,
      hasMetadata: !!workflow?.workflow_json?.mobile_ui_metadata,
      nodeMetadataSize: nodeMetadata?.size || 0,
      workflowNodeCount: workflow?.graph?._nodes?.length || 0
    });
    
    if (!workflow?.workflow_json) {
      return [];
    }

    const nodesWithControl: NodeSeedControl[] = [];
    
    // NEW APPROACH: Use workflow metadata for control_after_generate values
    if (workflow.workflow_json.mobile_ui_metadata?.control_after_generate) {
      const metadataControls = workflow.workflow_json.mobile_ui_metadata.control_after_generate;
      
      Object.entries(metadataControls).forEach(([nodeIdStr, controlValue]) => {
        const nodeId = Number(nodeIdStr);
        
        // Verify the node still exists and has seed values
        const hasSeedInNode = checkNodeHasSeed(workflow, nodeId);
        
        if (hasSeedInNode) {
          // Get real-time changed value (check widgetEditor first)
          const editorValue = widgetEditor.getWidgetValue(nodeId, 'control_after_generate', null);
          const currentControlValue = editorValue || controlValue || 'fixed';
          
          console.log(`📱 Found control_after_generate from metadata for node ${nodeId}:`, {
            metadataValue: controlValue,
            editorValue,
            finalValue: currentControlValue
          });
          
          nodesWithControl.push({ nodeId, controlValue: currentControlValue });
        } else {
        }
      });
    }
    
    // FALLBACK: Legacy detection for workflows without metadata
    if (nodesWithControl.length === 0 && workflow.graph?._nodes) {
      
      workflow.graph._nodes.forEach((node: any) => {
        const nodeId = Number(node.id);
        
        // Check both widgets and _widgets arrays for control_after_generate
        const allWidgets = [
          ...(node.widgets || []),
          ...(node._widgets || [])
        ];
        
        const controlWidget = allWidgets.find((widget: any) => 
          widget.name === 'control_after_generate'
        );
        
        if (controlWidget) {
          const editorValue = widgetEditor.getWidgetValue(nodeId, 'control_after_generate', null);
          const currentControlValue = editorValue || controlWidget.value || 'fixed';
          
          nodesWithControl.push({ nodeId, controlValue: currentControlValue });
        } else if (checkNodeHasSeed(workflow, nodeId)) {
          // Node has seed but no control_after_generate - use default
          nodesWithControl.push({ nodeId, controlValue: 'fixed' });
        }
      });
    }

    return nodesWithControl;
}

/**
 * Helper function to check if a node has seed values
 */
function checkNodeHasSeed(workflow: IComfyWorkflow | null, nodeId: number): boolean {
  if (!workflow?.graph?._nodes) return false;
  
  const node = workflow.graph._nodes.find((n: any) => Number(n.id) === nodeId);
  if (!node) return false;
  
  // Check if _widgets exists (it should always exist in properly parsed nodes)
  if (!(node as any)._widgets) {
    throw new Error(
      `❌ CRITICAL: Node ${nodeId} (type: ${(node as any).type}) is missing _widgets array! ` +
      `This indicates a parsing issue. Node structure: ${JSON.stringify(Object.keys(node as any), null, 2)}`
    );
  }
  
  // Primary method: Check _widgets array for seed
  const _widgets = (node as any)._widgets;
  const hasWidgetsSeed = _widgets.some((widget: any) => widget.name === 'seed' || widget.name === 'noise_seed');
  
  // Also check inputs array for additional validation
  const inputs = (node as any).inputs || [];
  const hasInputsSeed = inputs.some((input: any) => 
    (input.name === 'seed' || input.name === 'noise_seed') && 
    input.widget && 
    (input.widget.name === 'seed' || input.widget.name === 'noise_seed')
  );
  
  const result = hasWidgetsSeed;
  
  console.log(`🔍 checkNodeHasSeed for node ${nodeId} (${(node as any).type}):`, {
    hasWidgetsSeed,
    hasInputsSeed,
    _widgetsCount: _widgets.length,
    inputsCount: inputs.length,
    result
  });
  
  return result;
}

/**
 * Get current seed values for a specific node
 * @param nodeId - Node ID
 * @param nodeMetadata - Node metadata map
 * @param widgetEditor - Widget editor instance
 * @returns Array of seed values
 */
export function getCurrentSeedValues(
  nodeId: number,
  nodeMetadata: Map<number, INodeWithMetadata> | null,
  widgetEditor: WidgetEditor,
  workflow?: IComfyWorkflow | null
): NodeSeedValue[] {
    
    // First try to find the node in workflow graph directly
    if (workflow?.graph?._nodes) {
      const node = workflow.graph._nodes.find((n: any) => Number(n.id) === nodeId);
      if (node) {
        console.log(`🔍 Found node ${nodeId} in graph:`, {
          hasWidgets: !!(node as any).widgets,
          has_widgets: !!(node as any)._widgets,
          widgets_values: (node as any).widgets_values
        });
        
        // Check if _widgets exists (critical requirement)
        if (!(node as any)._widgets) {
          throw new Error(
            `❌ CRITICAL: Node ${nodeId} (type: ${(node as any).type}) is missing _widgets array in getCurrentSeedValues! ` +
            `This indicates a parsing issue. Node structure: ${JSON.stringify(Object.keys(node as any), null, 2)}`
          );
        }
        
        // Primary method: Check _widgets array for seed (most accurate)
        const _widgets = (node as any)._widgets;
        const seedWidgets = _widgets.filter((widget: any) => widget.name === 'seed' || widget.name === 'noise_seed');
        
        if (seedWidgets.length > 0) {
          return seedWidgets.map((widget: any) => ({
            name: widget.name,
            value: widgetEditor.getWidgetValue(nodeId, widget.name, widget.value)
          }));
        }
        
        return [];
      }
    }
    
    // Fallback to nodeMetadata approach
    if (!nodeMetadata) return [];

    const nodeMeta = nodeMetadata.get(nodeId);
    if (!nodeMeta?.widgetParameters) return [];

    return nodeMeta.widgetParameters
      .filter((param: any) => {
        // Only include parameters with exactly "seed" name
        return param.name === 'seed' || param.name === 'noise_seed';
      })
      .map((param: any) => ({
        name: param.name,
        value: widgetEditor.getWidgetValue(nodeId, param.name, param.value)
      }));
}

/**
 * Get widget_values indices for seed parameters
 * @param nodeId - Node ID
 * @param nodeMetadata - Node metadata map
 * @returns Array of seed parameter indices
 */
export function getSeedParameterIndices(
  nodeId: number,
  nodeMetadata: Map<number, INodeWithMetadata> | null
): SeedParameterIndex[] {
    if (!nodeMetadata) return [];

    const nodeMeta = nodeMetadata.get(nodeId);
    if (!nodeMeta?.widgetParameters) return [];

    const seedIndices: SeedParameterIndex[] = [];
    
    nodeMeta.widgetParameters.forEach((param: any, index: number) => {
      // Only include parameters with exactly "seed" name
      if (param.name === 'seed' || param.name === 'noise_seed') {
        seedIndices.push({ name: param.name, index });
      }
    });

  return seedIndices;
}

/**
 * Automatically change seed values based on control settings
 * @param workflow - Current workflow
 * @param nodeMetadata - Node metadata map
 * @param widgetEditor - Widget editor instance
 * @param isForceRandomize - Force randomization regardless of control setting
 * @returns Array of applied changes
 */
export async function autoChangeSeed(
  workflow: IComfyWorkflow | null,
  nodeMetadata: Map<number, INodeWithMetadata> | null,
  widgetEditor: WidgetEditor,
  isForceRandomize: boolean = false
): Promise<SeedChange[]> {
    if (!workflow) return [];

  const nodesWithControl = getNodesWithSeedControl(workflow, nodeMetadata, widgetEditor);
    
    if (nodesWithControl.length === 0) {
      return [];
    }

    const changes: SeedChange[] = [];

    for (const { nodeId, controlValue } of nodesWithControl) {
    const seedValues = getCurrentSeedValues(nodeId, nodeMetadata, widgetEditor, workflow);

      for (const seedValue of seedValues) {
        const currentValue = seedValue.value;
        let newValue = currentValue;

        // Processing seed parameter

        let controlValueCopy = controlValue;
        if (isForceRandomize) {
          controlValueCopy = 'randomize';
        }
        
        switch (controlValueCopy) {
          case 'randomize':
            newValue = Math.floor(Math.random() * 0xFFFFFFFF);
            break;
          case 'increment':
            newValue = (typeof currentValue === 'number' ? currentValue : 0) + 1;
            break;
          case 'decrement':
            newValue = Math.max(0, (typeof currentValue === 'number' ? currentValue : 0) - 1);
            break;
          case 'fixed':
          default:
            continue;
        }

        changes.push({
          nodeId,
          paramName: seedValue.name,
          oldValue: currentValue,
          newValue,
          controlValue
        });

        // Apply the change
        widgetEditor.setWidgetValue(nodeId, seedValue.name, newValue);
      }
    }

  if (changes.length === 0) {
    return [];
  }

  return changes;
}

/**
 * Generate a random seed value
 * @returns Random 32-bit unsigned integer
 */
export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}

/**
 * Check if a parameter is a seed parameter
 * @param paramName - Parameter name
 * @returns True if parameter is a seed
 */
export function isSeedParameter(paramName: string): boolean {
  return paramName === 'seed' || paramName === 'noise_seed';
}

/**
 * Check if a parameter is any type of seed parameter (including variations)
 * @param paramName - Parameter name
 * @returns True if parameter is any type of seed
 */
export function isSeedParameterVariant(paramName: string): boolean {
  const lowerName = paramName.toLowerCase();
  return lowerName.includes('seed') || lowerName.includes('noise_seed') || lowerName.includes('rand_seed');
}

/**
 * Validate seed value
 * @param value - Value to validate
 * @returns True if valid seed value
 */
export function isValidSeedValue(value: any): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF;
}

// Main export object containing all seed processing utilities
export const SeedProcessingUtils = {
  getNodesWithSeedControl,
  generateRandomSeed,
  isSeedParameter,
  isSeedParameterVariant,
  isValidSeedValue
} as const;