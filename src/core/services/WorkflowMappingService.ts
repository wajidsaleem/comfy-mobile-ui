/**
 * Workflow Mapping Service
 * 
 * Applies custom widget mappings to workflow nodes for dynamic widget generation.
 * Combines node mapping data with widget type definitions to create enhanced node metadata.
 */

import ComfyApiClient from '@/infrastructure/api/ComfyApiClient';
import { WidgetTypeDefinition } from '@/shared/types/app/WidgetFieldTypes';

export interface NodeMappingData {
  nodeType: string;
  scope?: {
    type: 'global' | 'workflow' | 'specific';
    workflowId?: string;
    workflowName?: string;
    nodeId?: string;
  };
  inputMappings: Record<string, string>; // fieldName -> widgetType
  customFields: Array<{
    fieldName: string;
    assignedWidgetType: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface EnhancedNodeInput {
  name: string;
  type: string;
  link?: number;
  widget?: {
    type: string;
    config?: any;
  };
  widgetType?: string; // LORA_CONFIG, etc.
  widgetDefinition?: WidgetTypeDefinition;
  isCustomField?: boolean;
}

export interface EnhancedWorkflowNode {
  id: number;
  type: string;
  pos: [number, number];
  size: [number, number];
  flags: any;
  order: number;
  mode: number;
  inputs: EnhancedNodeInput[];
  outputs: any[];
  properties: any;
  widgets_values?: any[];
  color?: string;
  bgcolor?: string;
  title?: string;
  // Enhanced fields
  hasCustomMappings?: boolean;
  mappingData?: NodeMappingData;
  customFields?: EnhancedNodeInput[];
}

export class WorkflowMappingService {
  private static nodeMappingsCache: Map<string, NodeMappingData[]> = new Map(); // Now stores arrays of mappings
  private static allMappingsCache: NodeMappingData[] = []; // Store all mappings for filtering
  private static widgetTypesCache: Map<string, WidgetTypeDefinition> = new Map();
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Load and cache all node mappings and widget types (public version)
   */
  static async loadMappingData(): Promise<void> {
    return this.loadMappingDataInternal();
  }

  /**
   * Load and cache all node mappings and widget types (private implementation)
   */
  private static async loadMappingDataInternal(): Promise<void> {
    const now = Date.now();
    
    // Use cache if recent
    if (now - this.cacheTimestamp < this.CACHE_DURATION && 
        this.nodeMappingsCache.size > 0 && 
        this.widgetTypesCache.size > 0) {
      return;
    }

    try {
      console.log('🔄 Loading node mappings from API...');
      // Load node mappings
      const nodeMappings = await ComfyApiClient.getCustomNodeMappings();
      console.log('📥 Received node mappings:', nodeMappings.length);
      
      this.nodeMappingsCache.clear();
      this.allMappingsCache = nodeMappings;
      
      // Group mappings by nodeType for efficient lookup
      nodeMappings.forEach((mapping: NodeMappingData) => {
        const existing = this.nodeMappingsCache.get(mapping.nodeType) || [];
        existing.push(mapping);
        this.nodeMappingsCache.set(mapping.nodeType, existing);
        
        const scopeInfo = mapping.scope 
          ? `(${mapping.scope.type}${mapping.scope.workflowId ? ':' + mapping.scope.workflowId : ''}${mapping.scope.nodeId ? ':' + mapping.scope.nodeId : ''})`
          : '(legacy)';
        console.log(`  📝 Cached mapping for: ${mapping.nodeType} ${scopeInfo}`);
      });

      console.log('🔄 Loading widget types from API...');
      // Load widget types
      const widgetTypes = await ComfyApiClient.getAllCustomWidgetTypes();
      console.log('📥 Received widget types:', widgetTypes.length);
      
      this.widgetTypesCache.clear();
      widgetTypes.forEach((widgetType: WidgetTypeDefinition) => {
        this.widgetTypesCache.set(widgetType.id, widgetType);
        console.log(`  🎨 Cached widget type: ${widgetType.id}`);
      });

      this.cacheTimestamp = now;
      console.log('📦 WorkflowMappingService: Loaded mappings and widget types', {
        mappings: this.nodeMappingsCache.size,
        widgetTypes: this.widgetTypesCache.size
      });

    } catch (error) {
      console.error('Failed to load mapping data:', error);
      // Continue with empty caches - workflow will work without custom mappings
    }
  }

  /**
   * Get node mapping synchronously (requires loadMappingData to be called first)
   * Returns the first mapping found (for backward compatibility)
   */
  static getNodeMappingSync(nodeType: string): NodeMappingData | null {
    const mappings = this.nodeMappingsCache.get(nodeType);
    return mappings && mappings.length > 0 ? mappings[0] : null;
  }

  /**
   * Get applicable node mappings based on scope filtering
   * @param nodeType The node type to get mappings for
   * @param currentWorkflowId The current workflow ID (for scope filtering)
   * @param currentNodeId The current node ID (for specific scope filtering)
   * @returns Array of applicable NodeMappingData
   */
  static getApplicableNodeMappings(
    nodeType: string, 
    currentWorkflowId?: string, 
    currentNodeId?: string
  ): NodeMappingData[] {
    const mappingsForType = this.nodeMappingsCache.get(nodeType) || [];
    
    if (mappingsForType.length === 0) {
      return [];
    }

    const applicableMappings: NodeMappingData[] = [];

    mappingsForType.forEach(mapping => {
      const scope = mapping.scope || { type: 'global' };
      
      console.log(`🔍 Checking mapping scope for ${nodeType}:`, scope);
      
      switch (scope.type) {
        case 'global':
          // Global mappings always apply
          console.log(`  ✅ Global mapping applies to all workflows`);
          applicableMappings.push(mapping);
          break;
          
        case 'workflow':
          // Workflow mappings apply if the workflow ID matches
          if (currentWorkflowId && scope.workflowId === currentWorkflowId) {
            console.log(`  ✅ Workflow mapping applies (workflow: ${currentWorkflowId})`);
            applicableMappings.push(mapping);
          } else {
            console.log(`  ❌ Workflow mapping skipped (current: ${currentWorkflowId}, required: ${scope.workflowId})`);
          }
          break;
          
        case 'specific':
          // Specific mappings apply if both workflow ID and node ID match
          if (currentWorkflowId && currentNodeId &&
              scope.workflowId === currentWorkflowId && 
              scope.nodeId === currentNodeId) {
            console.log(`  ✅ Specific mapping applies (workflow: ${currentWorkflowId}, node: ${currentNodeId})`);
            applicableMappings.push(mapping);
          } else {
            console.log(`  ❌ Specific mapping skipped (current: ${currentWorkflowId}/${currentNodeId}, required: ${scope.workflowId}/${scope.nodeId})`);
          }
          break;
          
        default:
          console.warn(`  ⚠️ Unknown scope type: ${scope.type}, treating as global`);
          applicableMappings.push(mapping);
          break;
      }
    });

    console.log(`📝 Found ${applicableMappings.length} applicable mappings for ${nodeType}`);
    return applicableMappings;
  }

  /**
   * Get widget definition synchronously (requires loadMappingData to be called first)
   */
  static getWidgetDefinitionSync(widgetType: string): WidgetTypeDefinition | null {
    return this.widgetTypesCache.get(widgetType) || null;
  }

  /**
   * Apply custom mappings to a workflow JSON
   */
  static async applyMappingsToWorkflow(workflowJson: any): Promise<any> {
    await this.loadMappingDataInternal();

    if (!workflowJson || !workflowJson.workflow) {
      return workflowJson;
    }

    const enhancedWorkflow = JSON.parse(JSON.stringify(workflowJson)); // Deep clone
    const nodes = enhancedWorkflow.workflow;

    // Process each node
    Object.keys(nodes).forEach(nodeId => {
      const node = nodes[nodeId];
      const nodeType = node.class_type || node.type;
      
      if (!nodeType) return;

      // Check if this node type has custom mappings
      const mappingDataArray = this.nodeMappingsCache.get(nodeType);
      if (!mappingDataArray || mappingDataArray.length === 0) return;

      // Use the first mapping (highest priority)
      const mappingData = mappingDataArray[0];
      console.log(`🔧 Applying mappings to node ${nodeId} (${nodeType}):`, mappingData);

      // Enhance the node with mapping data
      const enhancedNode = this.enhanceNodeWithMappings(node, mappingData);
      nodes[nodeId] = enhancedNode;
    });

    return enhancedWorkflow;
  }

  /**
   * Enhance a single node with custom mapping data
   */
  private static enhanceNodeWithMappings(node: any, mappingData: NodeMappingData): EnhancedWorkflowNode {
    const enhancedNode: EnhancedWorkflowNode = {
      ...node,
      hasCustomMappings: true,
      mappingData,
      customFields: []
    };

    // Process existing inputs with mappings
    if (enhancedNode.inputs) {
      enhancedNode.inputs = enhancedNode.inputs.map((input: any) => {
        const widgetType = mappingData.inputMappings[input.name];
        if (widgetType) {
          const widgetDefinition = this.widgetTypesCache.get(widgetType);
          console.log(`  🔄 Overriding input "${input.name}" type: ${input.type} → ${widgetType}`);
          return {
            ...input,
            originalType: input.originalType || input.type, // Backup original type
            type: widgetType, // Custom type
            widgetType,
            widgetDefinition,
            isCustomField: false,
            isOverridden: true // Mark as overridden
          };
        }
        return input;
      });
    } else {
      enhancedNode.inputs = [];
    }

    // Add custom fields
    mappingData.customFields.forEach(customField => {
      const widgetDefinition = this.widgetTypesCache.get(customField.assignedWidgetType);
      const customInput: EnhancedNodeInput = {
        name: customField.fieldName,
        type: customField.assignedWidgetType,
        widgetType: customField.assignedWidgetType,
        widgetDefinition,
        isCustomField: true
      };
      
      enhancedNode.inputs.push(customInput);
      enhancedNode.customFields!.push(customInput);
    });

    console.log(`✨ Enhanced node ${node.id || 'unknown'} with ${enhancedNode.inputs.length} inputs (${enhancedNode.customFields!.length} custom)`);

    return enhancedNode;
  }

  /**
   * Get widget definition for a specific widget type
   */
  static async getWidgetDefinition(widgetType: string): Promise<WidgetTypeDefinition | null> {
    await this.loadMappingDataInternal();
    return this.widgetTypesCache.get(widgetType) || null;
  }

  /**
   * Get node mapping for a specific node type
   */
  static async getNodeMapping(nodeType: string): Promise<NodeMappingData | null> {
    await this.loadMappingDataInternal();
    const mappings = this.nodeMappingsCache.get(nodeType);
    return mappings && mappings.length > 0 ? mappings[0] : null;
  }

  /**
   * Get all mappings (used for preprocessing)
   */
  static getAllMappings(): NodeMappingData[] {
    return this.allMappingsCache;
  }

  /**
   * Clear cache (useful for testing or when mappings are updated)
   */
  static clearCache(): void {
    this.nodeMappingsCache.clear();
    this.allMappingsCache = [];
    this.widgetTypesCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Restore original workflow by removing custom mappings and fields
   */
  static restoreOriginalWorkflow(workflowJson: any): any {
    if (!workflowJson || !workflowJson.workflow) {
      return workflowJson;
    }

    const restoredWorkflow = JSON.parse(JSON.stringify(workflowJson)); // Deep clone
    const nodes = restoredWorkflow.workflow;

    console.log('🔄 Restoring original workflow state...');

    // Process each node
    Object.keys(nodes).forEach(nodeId => {
      const node = nodes[nodeId];
      
      if (!node.inputs || !node.hasCustomMappings) return;

      console.log(`  📝 Restoring node ${nodeId}:`, node.class_type || node.type);

      // Restore original input types and remove custom fields
      node.inputs = node.inputs.filter((input: any) => {
        // Remove custom fields (newly added inputs)
        if (input.isCustomField === true) {
          console.log(`    🗑️ Removing custom field: ${input.name}`);
          return false; // Remove
        }

        // Restore original type for overridden inputs
        if (input.isOverridden && input.originalType) {
          console.log(`    🔄 Restoring "${input.name}" type: ${input.type} → ${input.originalType}`);
          input.type = input.originalType;
          // Remove custom attributes
          delete input.originalType;
          delete input.widgetType;
          delete input.widgetDefinition;
          delete input.isOverridden;
        }

        return true; // Keep
      });

      // Remove custom mapping related attributes
      delete node.hasCustomMappings;
      delete node.mappingData;
      delete node.customFields;
    });

    console.log('✅ Original workflow restored');
    return restoredWorkflow;
  }

  /**
   * Generate default value for a widget field based on its definition
   */
  static generateDefaultValue(fieldConfig: any, widgetDefinition?: WidgetTypeDefinition): any {
    // First try widget definition default values
    if (widgetDefinition?.defaultValue !== undefined) {
      const defaultValues = widgetDefinition.defaultValue;
      
      // For single field widgets, the defaultValue is the direct value
      const fieldNames = Object.keys(widgetDefinition.fields || {});
      if (fieldNames.length === 1 && fieldNames[0] === fieldConfig.name) {
        return defaultValues;
      }
      
      // For multi-field widgets, extract from object
      if (typeof defaultValues === 'object' && defaultValues !== null && fieldConfig.name in defaultValues) {
        return defaultValues[fieldConfig.name];
      }
    }

    // Fallback to field config defaults or type-based defaults
    if (fieldConfig.default !== undefined) {
      return fieldConfig.default;
    }

    // Type-based defaults
    switch (fieldConfig.type) {
      case 'boolean':
        return false;
      case 'int':
      case 'float':
        return fieldConfig.min !== undefined ? fieldConfig.min : 0;
      case 'string':
      case 'combo':
        return fieldConfig.options && fieldConfig.options.length > 0 
          ? fieldConfig.options[0] 
          : '';
      default:
        return null;
    }
  }
}

export default WorkflowMappingService;