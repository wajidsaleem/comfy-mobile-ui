/**
 * Special Node Widget Processor
 * 
 * Handles widget creation for custom nodes that don't rely on server metadata.
 * This approach is used for nodes that use widgets_values directly without
 * corresponding entries in the server's object info metadata.
 */

import type { IComfyWidget } from '@/shared/types/app/base'

export interface SpecialNodeWidgetProcessor {
  /** Unique identifier for this processor */
  id: string;
  
  /** Display name for logging */
  name: string;
  
  /** Node types this processor handles */
  nodeTypes: string[];
  
  /** Widget creation function */
  createWidgets: (nodeType: string, widgetValues: any[], nodeMetadata?: any, workflowMetadata?: any) => IComfyWidget[];
  
  /** Optional description of what this processor does */
  description?: string;
}

/**
 * PrimitiveNode Widget Processor
 * 
 * Creates widgets for PrimitiveNode values to allow editing in the UI.
 * PrimitiveNodes are virtual nodes that get removed during API conversion
 * but need to be editable before that happens.
 */
const primitiveNodeWidgetProcessor: SpecialNodeWidgetProcessor = {
  id: 'primitive_node_widget_processor',
  name: 'PrimitiveNode Widget Processor',
  nodeTypes: ['PrimitiveNode'],
  description: 'Creates editable widgets for PrimitiveNode values',
  
  createWidgets: (nodeType: string, widgetValues: any[], nodeMetadata?: any, workflowMetadata?: any): IComfyWidget[] => {
    console.log(`🔧 Creating widgets for ${nodeType} from widgets_values`);
    
    const widgets: IComfyWidget[] = [];
    
    // PrimitiveNode typically has a single value in widgets_values[0]
    if (!Array.isArray(widgetValues) || widgetValues.length === 0) {
      console.warn(`⚠️ PrimitiveNode expected at least 1 widgets_value, got ${widgetValues?.length}`);
      return widgets;
    }
    
    const primitiveValue = widgetValues[0];
    
    // Always use STRING type for maximum flexibility
    // This allows input of numbers, text, or any other values
    let displayValue: string;
    let isMultiline = false;
    
    if (typeof primitiveValue === 'string') {
      displayValue = primitiveValue;
      isMultiline = primitiveValue.includes('\n');
    } else if (primitiveValue === null || primitiveValue === undefined) {
      displayValue = '';
    } else {
      // Convert numbers, booleans, arrays, objects to string representation
      displayValue = typeof primitiveValue === 'object' 
        ? JSON.stringify(primitiveValue, null, 2)
        : String(primitiveValue);
      isMultiline = displayValue.includes('\n');
    }
    
    const primitiveWidget: IComfyWidget = {
      name: 'value',
      type: 'STRING',
      value: displayValue,
      options: {
        tooltip: 'Primitive value (supports text, numbers, and any other values)',
        default: displayValue,
        multiline: isMultiline,
        placeholder: 'Enter any value...'
      }
    };
    
    widgets.push(primitiveWidget);
    
    console.log(`✅ Created PrimitiveNode widget: STRING with value:`, primitiveValue);
    return widgets;
  }
};

// Power Lora Loader processor removed - will be replaced with dynamic widget system

/**
 * Registry of all special node widget processors
 */
const SPECIAL_NODE_WIDGET_PROCESSORS: SpecialNodeWidgetProcessor[] = [
  primitiveNodeWidgetProcessor
  // Dynamic widget processors will replace hardcoded ones
];

/**
 * Check if a node type has a special widget processor
 */
export function hasSpecialNodeWidgetProcessor(nodeType: string): boolean {
  return SPECIAL_NODE_WIDGET_PROCESSORS.some(p => p.nodeTypes.includes(nodeType));
}

/**
 * Create widgets using special node processor if available
 */
export function createSpecialNodeWidgets(
  nodeType: string, 
  widgetValues: any[], 
  nodeMetadata?: any, 
  workflowMetadata?: any
): IComfyWidget[] | null {
  
  const processor = SPECIAL_NODE_WIDGET_PROCESSORS.find(p => p.nodeTypes.includes(nodeType));
  
  if (!processor) {
    return null; // No special processor for this node type
  }
  
  console.log(`🔧 Using special widget processor: ${processor.name}`);
  
  try {
    return processor.createWidgets(nodeType, widgetValues, nodeMetadata, workflowMetadata);
  } catch (error) {
    console.error(`❌ Error in special widget processor ${processor.name}:`, error);
    return null;
  }
}

/**
 * Get information about available special node widget processors
 */
export function getAvailableSpecialNodeWidgetProcessors(): SpecialNodeWidgetProcessor[] {
  return [...SPECIAL_NODE_WIDGET_PROCESSORS];
}

/**
 * Register a new special node widget processor
 */
export function registerSpecialNodeWidgetProcessor(processor: SpecialNodeWidgetProcessor): void {
  const existingIndex = SPECIAL_NODE_WIDGET_PROCESSORS.findIndex(p => p.id === processor.id);
  if (existingIndex >= 0) {
    console.warn(`⚠️ Special node widget processor with ID ${processor.id} already exists, replacing...`);
    SPECIAL_NODE_WIDGET_PROCESSORS[existingIndex] = processor;
  } else {
    SPECIAL_NODE_WIDGET_PROCESSORS.push(processor);
  }
  
  console.log(`📝 Registered special node widget processor: ${processor.name} (${processor.id})`);
}

// Export default function for convenience
export default createSpecialNodeWidgets;