/**
 * Workflow JSON Preprocessor
 * 
 * Handles special preprocessing logic for custom nodes at the workflow JSON stage.
 * This approach is better than Graph-stage preprocessing because:
 * - Modifies the source JSON before Graph conversion
 * - Allows existing Graph conversion logic to handle the modified structure naturally
 * - No conflicts with ComfyGraphNode initialization logic
 * 
 * Usage:
 * - Called before workflow JSON → Graph conversion
 * - Modifies workflow JSON structure in-place
 * - Ensures proper inputs and widgets_values for custom nodes
 */

export interface WorkflowJsonProcessor {
  /** Unique identifier for this processor */
  id: string;
  
  /** Display name for logging */
  name: string;
  
  /** Node types this processor handles */
  nodeTypes: string[];
  
  /** Processing function that modifies workflow JSON node in-place */
  process: (workflowJson: any, workflowId?: string) => void;
  
  /** Optional description of what this processor does */
  description?: string;
}

import WorkflowMappingService from '@/core/services/WorkflowMappingService';

/**
 * Custom widget type default value generator
 * Matches CustomDynamicWidget logic: single field returns direct value, multi-field returns object
 */
function generateDefaultValueForCustomWidget(widgetType: string): any {
  const customDefinition = WorkflowMappingService.getWidgetDefinitionSync(widgetType);
  if (!customDefinition || !customDefinition.fields) {
    return undefined;
  }
  
  const fields = customDefinition.fields;
  const fieldNames = Object.keys(fields);
  const isSingleField = fieldNames.length === 1;
  
  if (isSingleField) {
    // Single field: return direct value
    const fieldName = fieldNames[0];
    const fieldConfig = fields[fieldName];
    return fieldConfig.default;
  } else {
    // Multi-field: return object structure
    const defaultObject: any = {};
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      defaultObject[fieldName] = (fieldConfig as any).default;
    }
    return defaultObject;
  }
}

/**
 * Validate custom widget value structure
 */
function isValidCustomWidgetValue(widgetType: string, value: any): boolean {
  const customDefinition = WorkflowMappingService.getWidgetDefinitionSync(widgetType);
  if (!customDefinition || !customDefinition.fields) {
    return true; // Not a custom widget, validation passes
  }
  
  const fields = customDefinition.fields;
  const fieldNames = Object.keys(fields);
  const isSingleField = fieldNames.length === 1;
  
  if (isSingleField) {
    // Single field: primitive value expected
    return value !== null && value !== undefined && typeof value !== 'object';
  } else {
    // Multi-field: object expected with required fields
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    
    // Check if all required fields exist
    for (const fieldName of fieldNames) {
      if (!(fieldName in value)) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Validate and fix custom widget values in node's widgets_values array
 * @param node Node to process
 * @returns Whether changes were made
 */
function validateAndFixCustomWidgetValues(node: any): boolean {
  if (!node.inputs) {
    return false;
  }
  
  // Check if this node has custom widgets
  let hasCustomWidget = false;
  for (const input of node.inputs) {
    if (input.widget && input.type) {
      const customDefinition = WorkflowMappingService.getWidgetDefinitionSync(input.type);
      if (customDefinition) {
        hasCustomWidget = true;
        break;
      }
    }
  }
  
  // No custom widgets, skip processing
  if (!hasCustomWidget) {
    return false;
  }
  
  // widgets_values initialization
  if (node.widgets_values === null || node.widgets_values === undefined) {
    node.widgets_values = {};
  }
  
  let hasChanges = false;
  const isWidgetValuesArray = Array.isArray(node.widgets_values);
  const isWidgetValuesObject = !isWidgetValuesArray && typeof node.widgets_values === 'object';
  
  if (isWidgetValuesArray) {
    // Array processing (original logic)
    let widgetValueIndex = 0;
    
    for (const input of node.inputs) {
      if (input.widget && input.type) {
        // Only inputs with widgets are mapped to widgets_values
        if (widgetValueIndex >= node.widgets_values.length) {
          // Extend widgets_values array if needed
          node.widgets_values.push(undefined);
          hasChanges = true;
        }
        
        const currentValue = node.widgets_values[widgetValueIndex];
        
        // Check if it's a custom widget
        const customDefinition = WorkflowMappingService.getWidgetDefinitionSync(input.type);
        if (customDefinition) {
          // Validate and fix custom widget value
          if (!isValidCustomWidgetValue(input.type, currentValue)) {
            const defaultValue = generateDefaultValueForCustomWidget(input.type);
            node.widgets_values[widgetValueIndex] = defaultValue;
            hasChanges = true;
            
            console.log(`🔧 Fixed custom widget value for "${input.name}" (${input.type}):`, {
              nodeId: node.id,
              oldValue: currentValue,
              newValue: defaultValue
            });
          }
        }
        
        widgetValueIndex++;
      }
    }
  } else if (isWidgetValuesObject) {
    // Object processing (new logic)
    for (const input of node.inputs) {
      if (input.widget && input.type && input.name) {
        // Check if it's a custom widget
        const customDefinition = WorkflowMappingService.getWidgetDefinitionSync(input.type);
        if (customDefinition) {
          const inputName = input.name;
          const currentValue = node.widgets_values[inputName];
          
          // Add missing custom widget value if input name doesn't exist
          if (!(inputName in node.widgets_values)) {
            const defaultValue = generateDefaultValueForCustomWidget(input.type);
            node.widgets_values[inputName] = defaultValue;
            hasChanges = true;
            
            console.log(`🔧 Added missing custom widget value for "${inputName}" (${input.type}):`, {
              nodeId: node.id,
              newValue: defaultValue
            });
          } 
          // Fix custom widget value if it exists but has incorrect type
          else if (!isValidCustomWidgetValue(input.type, currentValue)) {
            const defaultValue = generateDefaultValueForCustomWidget(input.type);
            node.widgets_values[inputName] = defaultValue;
            hasChanges = true;
            
            console.log(`🔧 Fixed custom widget value for "${inputName}" (${input.type}):`, {
              nodeId: node.id,
              oldValue: currentValue,
              newValue: defaultValue
            });
          }
        }
      }
    }
  } else {
    // widgets_values is not an array or object (e.g., string, number)
    console.log(`⚠️ Node ${node.id} has invalid widgets_values type:`, typeof node.widgets_values);
    return false;
  }
  
  return hasChanges;
}

/**
 * Cleanup function for existing custom fields
 * Removes existing custom mappings and restores original state
 */
function cleanupExistingCustomFields(workflowJson: any) {
  if (!workflowJson) return;
  
  const nodes = workflowJson.nodes || [];
  
  nodes.forEach((node: any) => {
    if (!node || !node.inputs) return;
    
    node.inputs = node.inputs.filter((input: any) => {
      if (input.isCustomField === true) {
        if (input.originalType) {
          // Overridden field: restore original type
          input.type = input.originalType;
          delete input.originalType;
          delete input.isCustomField;
          if (input.widget?.isCustomField) {
            delete input.widget.isCustomField;
          }
          return true; // not removed
        } else {
          // Remove newly added custom field
          return false; // removed
        }
      }
      return true; // not removed
    });
  });
}

/**
 * Cleanup function for existing custom fields in a single node
 * Removes existing custom mappings and restores original state
 * 
 * Usage:
 * - NodePatch.tsx: Node selection to preserve original node structure unaffected by patches
 * - WorkflowJsonPreprocessor.ts: Cleanup before scope-based mapping application
 * 
 * @param nodeData - Node data to clean up
 * @returns Cleaned-up node data (original not modified, immutable)
 */
function cleanupSingleNodeCustomFields(nodeData: any): any {
  if (!nodeData || !nodeData.inputs) {
    return nodeData;
  }
  
  const cleanedNodeData = { ...nodeData };
  
  cleanedNodeData.inputs = nodeData.inputs.filter((input: any) => {
    if (input.isCustomField === true) {
      if (input.originalType) {
        // Restore original type
        input.type = input.originalType;
        delete input.originalType;
        delete input.isCustomField;
        if (input.widget?.isCustomField) {
          delete input.widget.isCustomField;
        }
        return true; // not removed
      } else {
        // Remove newly added custom field
        return false; // removed
      }
    }
    return true; // not removed
  });
  
  return cleanedNodeData;
}

/**
 * Dynamic Node Mapping Processor
 * Applies custom widget mappings to workflow nodes based on user configurations
 * Priority: Global → Workflow → Specific (higher priority overwrites lower priority)
 */
const DYNAMIC_NODE_MAPPING_PROCESSOR: WorkflowJsonProcessor = {
  id: 'dynamic-node-mapping',
  name: 'Dynamic Node Mapping',
  nodeTypes: [], // Will match all node types dynamically
  description: 'Applies custom widget mappings and adds custom fields to workflow nodes with scope-based priority',
  
  process: async (workflowJson: any, currentWorkflowId?: string) => {
    
    if (!workflowJson) return;
    
    // 1. Cleanup existing custom fields
    cleanupExistingCustomFields(workflowJson);
    
    // 2. Load mapping data
    try {
      await WorkflowMappingService.loadMappingData();
    } catch (error) {
      console.error('❌ Failed to load mapping data:', error);
      return;
    }
    
    const nodes = workflowJson.nodes || [];
    
    // 3. Scope-based mapping separation
    const allMappings = WorkflowMappingService.getAllMappings();
    const globalMappings = allMappings.filter(m => !m.scope || m.scope.type === 'global');
    const workflowMappings = allMappings.filter(m => m.scope?.type === 'workflow' && m.scope.workflowId === currentWorkflowId);
    const specificMappings = allMappings.filter(m => m.scope?.type === 'specific' && m.scope.workflowId === currentWorkflowId);
    
    if (globalMappings.length + workflowMappings.length + specificMappings.length === 0) {
      return; // No mappings to apply
    }
    
    // 4. Node-specific mapping application (Specific > Workflow > Global)
    nodes.forEach((node: any) => {
      const nodeType = node.class_type || node.type;
      const nodeId = node.id?.toString();
      
      // Find applicable mappings in priority order
      const applicableSpecificMappings = specificMappings.filter(m => 
        m.nodeType === nodeType && m.scope?.nodeId === nodeId
      );
      
      const applicableWorkflowMappings = workflowMappings.filter(m => m.nodeType === nodeType);
      const applicableGlobalMappings = globalMappings.filter(m => m.nodeType === nodeType);
      
      // Apply the highest priority scope
      if (applicableSpecificMappings.length > 0) {
        // Specific scope application (highest priority)
        applicableSpecificMappings.forEach(mapping => applyMapping(node, mapping));
      } else if (applicableWorkflowMappings.length > 0) {
        // Workflow scope application
        applicableWorkflowMappings.forEach(mapping => applyMapping(node, mapping));
      } else if (applicableGlobalMappings.length > 0) {
        // Global scope application
        applicableGlobalMappings.forEach(mapping => applyMapping(node, mapping));
      }
    });
  }
};

/**
 * Apply mapping to a single node
 * @param node Node to apply mapping to
 * @param mappingData Mapping data
 */
function applyMapping(node: any, mappingData: any) {
  // Ensure node has inputs array
  if (!node.inputs) {
    node.inputs = [];
  }
  
  // Apply input mappings (change existing input types)
  if (mappingData.inputMappings) {
    Object.entries(mappingData.inputMappings).forEach(([inputName, widgetType]) => {
      const existingInput = node.inputs.find((input: any) => input.name === inputName);
      if (existingInput) {
        if (!existingInput.originalType) {
          existingInput.originalType = existingInput.type;
        }
        existingInput.type = widgetType;
        existingInput.widget = { name: existingInput.name, isCustomField: true };
        existingInput.isCustomField = true;
      }
    });
  }
  
  // Add custom fields (new inputs)
  if (mappingData.customFields) {
    mappingData.customFields.forEach((customField: any) => {
      const existingCustomField = node.inputs.find((input: any) => input.name === customField.fieldName);
      
      if (!existingCustomField) {
        node.inputs.push({
          name: customField.fieldName,
          type: customField.assignedWidgetType,
          widget: { name: customField.fieldName, isCustomField: true },
          isCustomField: true,
          link: null
        });
      } else {
        existingCustomField.type = customField.assignedWidgetType;
        existingCustomField.widget = { name: customField.fieldName, isCustomField: true };
        existingCustomField.isCustomField = true;
        if (existingCustomField.link === undefined) {
          existingCustomField.link = null;
        }
      }
    });
  }
}

/**
 * Custom Widget Values Validation Processor
 * Ensures widgets_values contain proper default values for custom widget types
 */
const CUSTOM_WIDGET_VALUES_PROCESSOR: WorkflowJsonProcessor = {
  id: 'custom-widget-values',
  name: 'Custom Widget Values Validation',
  nodeTypes: [], // Will match all node types
  description: 'Validates and fixes widgets_values for custom widget types with proper default values',
  
  process: async (workflowJson: any, currentWorkflowId?: string) => {
    if (!workflowJson) return;
    
    const nodes = workflowJson.nodes || [];
    let widgetValueFixedCount = 0;
    
    nodes.forEach((node: any) => {
      const hasChanges = validateAndFixCustomWidgetValues(node);
      if (hasChanges) {
        widgetValueFixedCount++;
      }
    });
    
    if (widgetValueFixedCount > 0) {
      console.log(`✅ [Custom Widget Values] Fixed widget values in ${widgetValueFixedCount} nodes`);
    }
  }
};

/**
 * Registry of all workflow JSON preprocessors
 * Will be populated dynamically based on user configurations
 */
const WORKFLOW_JSON_PROCESSORS: WorkflowJsonProcessor[] = [
  DYNAMIC_NODE_MAPPING_PROCESSOR,
  CUSTOM_WIDGET_VALUES_PROCESSOR
];

/**
 * Main entry point for workflow JSON preprocessing
 * Called before workflow JSON → Graph conversion
 * 
 * @param workflowJson The complete workflow JSON object
 * @param workflowId Optional workflow ID for scope filtering
 */
export async function preprocessWorkflowJson(workflowJson: any, workflowId?: string): Promise<void> {
  
  // Get current workflow ID from URL if not provided
  let currentWorkflowId = workflowId;
  if (!currentWorkflowId && typeof window !== 'undefined') {
    // Extract workflowId from URL path: /workflow/[workflowId]
    const pathname = window.location.pathname;
    const workflowMatch = pathname.match(/\/workflow\/([^\/]+)/);
    if (workflowMatch && workflowMatch[1]) {
      currentWorkflowId = workflowMatch[1];
      console.log(`🔗 Extracted workflowId from URL: ${currentWorkflowId}`);
    }
  }
  
  let totalProcessedNodes = 0;
  
  // Apply all registered processors
  for (const processor of WORKFLOW_JSON_PROCESSORS) {
    try {
      await processor.process(workflowJson, currentWorkflowId);
    } catch (error) {
      console.error(`❌ Error in workflow JSON processor ${processor.name}:`, error);
    }
  }
  
}

/**
 * Get information about available workflow JSON preprocessors
 */
export function getAvailableWorkflowProcessors(): WorkflowJsonProcessor[] {
  return [...WORKFLOW_JSON_PROCESSORS];
}

/**
 * Check if a node type has a workflow JSON preprocessor
 */
export function hasWorkflowProcessor(nodeType: string): boolean {
  return WORKFLOW_JSON_PROCESSORS.some(p => p.nodeTypes.includes(nodeType));
}

/**
 * Register a new workflow JSON preprocessor
 */
export function registerWorkflowProcessor(processor: WorkflowJsonProcessor): void {
  const existingIndex = WORKFLOW_JSON_PROCESSORS.findIndex(p => p.id === processor.id);
  if (existingIndex >= 0) {
    console.warn(`⚠️ Workflow processor with ID ${processor.id} already exists, replacing...`);
    WORKFLOW_JSON_PROCESSORS[existingIndex] = processor;
  } else {
    WORKFLOW_JSON_PROCESSORS.push(processor);
  }
  
}

// Export utility functions
export { cleanupSingleNodeCustomFields };

// Export the main preprocessing function as default
export default preprocessWorkflowJson;