import { useState, useCallback } from 'react';
import { useGlobalStore } from '@/ui/store/globalStore';
import { updateWorkflow, getWorkflow } from '@/infrastructure/storage/IndexedDBWorkflowService';
import { ComfyNodeMetadataService } from '@/infrastructure/api/ComfyNodeMetadataService';

interface SeedControlSettings {
  [nodeId: string]: 'fixed' | 'increment' | 'decrement' | 'randomize';
}

interface UseWorkflowStorageReturn {
  // Widget value operations
  saveWidgetValue: (workflowId: string, nodeId: number, paramName: string, value: any) => Promise<boolean>;
  saveWidgetValuesBatch: (workflowId: string, changes: Array<{nodeId: number, paramName: string, value: any}>) => Promise<boolean>;
  
  // Seed control operations
  getSeedControlSettings: (workflowId: string) => SeedControlSettings;
  setSeedControlSetting: (workflowId: string, nodeId: number, controlValue: 'fixed' | 'increment' | 'decrement' | 'randomize') => void;
  applySeedControls: (workflowId: string, nodeMetadata: Map<number, any>, getWidgetValue: (nodeId: number, paramName: string, defaultValue: any) => any) => Promise<void>;
  
  // State
  isLoading: boolean;
  lastSaveTime: Date | null;
}

const SEED_CONTROL_STORAGE_KEY = 'comfyui_seed_controls';

export const useWorkflowStorage = (): UseWorkflowStorageReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  
  // GlobalStore access
  const { workflow: selectedWorkflow, setWorkflow } = useGlobalStore();

  // Save single widget value change
  const saveWidgetValue = useCallback(async (workflowId: string, nodeId: number, paramName: string, value: any): Promise<boolean> => {
    
    try {
      setIsLoading(true);
      
      // use current selected workflow from GlobalStore or load from storage
      let savedWorkflow = selectedWorkflow?.id === workflowId ? selectedWorkflow : await getWorkflow(workflowId);
      if (!savedWorkflow) {
        console.warn(`⚠️ Workflow ${workflowId} not found in storage`);
        return false;
      }

      // Update workflow_json and _graph if they exist
      let updated = false;

      // Update workflow_json (for raw JSON storage)
      if (savedWorkflow.workflow_json?.nodes) {
        for (const [key, node] of Object.entries(savedWorkflow.workflow_json.nodes) as [string, any][]) {
          if (node.id === nodeId || parseInt(key) === nodeId) {
            // Handle different widget_values formats
            if (Array.isArray(node.widgets_values)) {
              // For array format, we need to find the parameter index
              // This requires understanding the parameter order for this node type
              try {
                const paramIndex = await findParameterIndex(nodeId, paramName, savedWorkflow);
                if (paramIndex !== -1 && paramIndex < node.widgets_values.length) {
                  node.widgets_values[paramIndex] = value;
                  updated = true;
                }
              } catch (error) {
                console.warn(`⚠️ Error finding parameter index for ${paramName} in workflow_json: ${error}`);
                // Continue to try _graph update even if workflow_json fails
              }
            } else if (typeof node.widgets_values === 'object') {
              // Object format
              if (!node.widgets_values) {
                node.widgets_values = {} as any;
              }
              (node.widgets_values as any)[paramName] = value;
              updated = true;
            }
          }
        }
      }

      // Update _graph (for processed data)
      
      if (savedWorkflow.graph?._nodes) {
        for (const node of savedWorkflow.graph._nodes) {
          if (node.id === nodeId) {
            
            // If widgets_values is empty array or doesn't exist, initialize it from workflow_json
            if (!node.widgets_values || (Array.isArray(node.widgets_values) && node.widgets_values.length === 0)) {
              // Find corresponding workflow_json node
              const jsonNode = Object.values(savedWorkflow.workflow_json?.nodes || {}).find((n: any) => n.id === nodeId) as any;
              if (jsonNode && jsonNode.widgets_values) {
                node.widgets_values = Array.isArray(jsonNode.widgets_values) 
                  ? [...jsonNode.widgets_values] 
                  : { ...jsonNode.widgets_values };
              }
            }
            
            if (Array.isArray(node.widgets_values)) {
              // For array format, we need to find the parameter index
              try {
                const paramIndex = await findParameterIndex(nodeId, paramName, savedWorkflow);
                if (paramIndex !== -1 && paramIndex < node.widgets_values.length) {
                  node.widgets_values[paramIndex] = value;
                  updated = true;
                }
              } catch (error) {
                console.warn(`⚠️ Error finding parameter index for ${paramName} in parsedData: ${error}`);
                // Continue processing other updates
              }
            } else if (typeof node.widgets_values === 'object') {
              if (!node.widgets_values) {
                node.widgets_values = {} as any;
              }
              (node.widgets_values as any)[paramName] = value;
              updated = true;
            }
          }
        }
      }

      if (updated) {        
        // update GlobalStore workflow (if current selected workflow)
        if (selectedWorkflow?.id === workflowId) {
          setWorkflow(savedWorkflow);
        }
        setLastSaveTime(new Date());
        return true;
      } else {
        console.warn(`⚠️ No updates made for node ${nodeId}`);
        return false;
      }
    } catch (error) {
      console.error('💾 [ERROR] saveWidgetValue failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save multiple widget value changes in batch
  const saveWidgetValuesBatch = useCallback(async (workflowId: string, changes: Array<{nodeId: number, paramName: string, value: any}>): Promise<boolean> => {
    try {
      setIsLoading(true);
      let allSucceeded = true;
      
      for (const change of changes) {
        const result = await saveWidgetValue(workflowId, change.nodeId, change.paramName, change.value);
        if (!result) {
          allSucceeded = false;
        }
      }
      return allSucceeded;
    } catch (error) {
      console.error('💾 [ERROR] saveWidgetValuesBatch failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveWidgetValue]);

  // Helper function to find parameter index in widgets_values array using NodeMetadataService logic
  const findParameterIndex = useCallback(async (nodeId: number, paramName: string, workflow: any): Promise<number> => {
    try {
      // Find the node in the workflow data
      let workflowNode = null;
      
      // Try graph first
      if (workflow.graph?._nodes) {
        workflowNode = workflow.graph._nodes.find((n: any) => n.id === nodeId);
      }
      
      // Try workflow_json if not found (object format)
      if (!workflowNode && workflow.workflow_json?.nodes) {
        // workflow_json.nodes is an object, so we need to iterate through entries
        for (const [key, node] of Object.entries(workflow.workflow_json.nodes) as [string, any][]) {
          if (node.id === nodeId || parseInt(key) === nodeId) {
            workflowNode = node;
            break;
          }
        }
      }
      
      if (!workflowNode) {
        console.warn(`⚠️ Node ${nodeId} not found in workflow data`);
        return -1;
      }
      
      // Use ComfyNodeMetadataService functions directly (not a class)
      // We need to get the node's metadata to calculate parameter order
      // For now, we'll try to reconstruct it from the node type
      const nodeMetadata = await ComfyNodeMetadataService.getNodeTypeMetadata(workflowNode.type);
      
      if (!nodeMetadata) {
        console.warn(`⚠️ No metadata found for node type: ${workflowNode.type}`);
        return -1;
      }
      
      // Use ComfyNodeMetadataService's logic to get parameter order
      // We need to access the private getParameterOrder method
      // Since it's private, we'll implement the same logic here
      const parameterOrder = getParameterOrderFromMetadata(nodeMetadata, workflowNode);
      const paramIndex = parameterOrder.indexOf(paramName);
      return paramIndex !== -1 ? paramIndex : -1;
      
    } catch (error) {
      console.error(`❌ Error finding parameter index for ${paramName}:`, error);
      return -1;
    }
  }, []);
  
  // Helper function that replicates ComfyNodeMetadataService's getParameterOrder logic
  const getParameterOrderFromMetadata = useCallback((metadata: any, node: any): string[] => {
    const order: string[] = [];

    // Get all linked input names from the node (these won't be in widget_values)
    const linkedInputs = new Set<string>();
    if (node?.inputs) {
      node.inputs.forEach((input: any) => {
        if (input.link !== null) {
          linkedInputs.add(input.name);
        }
      });
    }

    // Special handling for nodes with seed parameter
    const hasSeedWidget = metadata.input.required && 
                         (Object.keys(metadata.input.required).includes('seed') || Object.keys(metadata.input.required).includes('noise_seed')) && 
                         !linkedInputs.has('seed') && !linkedInputs.has('noise_seed');
    
    const hasControlAfterGenerate = (metadata.input.required && Object.keys(metadata.input.required).includes('control_after_generate')) ||
                                   (metadata.input.optional && Object.keys(metadata.input.optional).includes('control_after_generate'));
    
    if (hasSeedWidget && !hasControlAfterGenerate) {
      // For nodes with seed widget, widget_values order typically includes control_after_generate after seed
      const seedBasedOrder: string[] = [];
      
      // Add required parameters that don't have links, but insert control_after_generate after seed
      if (metadata.input.required) {
        Object.keys(metadata.input.required).forEach((paramName: string) => {
          if (!linkedInputs.has(paramName)) {
            seedBasedOrder.push(paramName);
            // Insert control_after_generate right after seed
            if (paramName === 'seed' || paramName === 'noise_seed') {
              seedBasedOrder.push('control_after_generate');
            }
          }
        });
      }

      // Add optional parameters that don't have links
      if (metadata.input.optional) {
        Object.keys(metadata.input.optional).forEach((paramName: string) => {
          if (!linkedInputs.has(paramName)) {
            seedBasedOrder.push(paramName);
          }
        });
      }

      return seedBasedOrder;
    }

    // Standard parameter ordering for other node types
    // Add required parameters that don't have links (in declaration order)
    if (metadata.input.required) {
      Object.keys(metadata.input.required).forEach((paramName: string) => {
        if (!linkedInputs.has(paramName)) {
          order.push(paramName);
        }
      });
    }

    // Add optional parameters that don't have links (in declaration order)
    if (metadata.input.optional) {
      Object.keys(metadata.input.optional).forEach((paramName: string) => {
        if (!linkedInputs.has(paramName)) {
          order.push(paramName);
        }
      });
    }

    return order;
  }, []);

  // Get seed control settings for a workflow
  const getSeedControlSettings = useCallback((workflowId: string): SeedControlSettings => {
    try {
      const stored = localStorage.getItem(SEED_CONTROL_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data[workflowId] || {};
      }
      return {};
    } catch (error) {
      console.warn('Failed to load seed control settings:', error);
      return {};
    }
  }, []);

  // Set seed control setting for a specific node
  const setSeedControlSetting = useCallback((workflowId: string, nodeId: number, controlValue: 'fixed' | 'increment' | 'decrement' | 'randomize') => {
    try {
      const stored = localStorage.getItem(SEED_CONTROL_STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      
      if (!data[workflowId]) {
        data[workflowId] = {};
      }
      
      data[workflowId][nodeId.toString()] = controlValue;
      localStorage.setItem(SEED_CONTROL_STORAGE_KEY, JSON.stringify(data));
      
    } catch (error) {
      console.warn('Failed to save seed control setting:', error);
    }
  }, []);

  // Apply seed controls during workflow execution
  const applySeedControls = useCallback(async (
    workflowId: string, 
    nodeMetadata: Map<number, any>, 
    getWidgetValue: (nodeId: number, paramName: string, defaultValue: any) => any
  ) => {
    const seedControlSettings = getSeedControlSettings(workflowId);
    if (Object.keys(seedControlSettings).length === 0) {
      return;
    }

    const nodesWithSeedControl: Array<{nodeId: number, seedParams: Array<{name: string, value: any}>, controlValue: string}> = [];

    // Find nodes with both seed parameters and control settings
    for (const [nodeIdStr, controlValue] of Object.entries(seedControlSettings)) {
      const nodeId = parseInt(nodeIdStr);
      const nodeMeta = nodeMetadata.get(nodeId);
      
      if (nodeMeta?.widgetParameters) {
        // Find seed parameters in the widget parameters
        const seedParams = nodeMeta.widgetParameters.filter((param: any) => {
          const lowerName = param.name.toLowerCase();
          return lowerName.includes('seed') || lowerName.includes('noise_seed') || lowerName.includes('rand_seed');
        }).map((param: any) => ({
          name: param.name,
          value: getWidgetValue(nodeId, param.name, param.value)
        }));

        if (seedParams.length > 0) {
          nodesWithSeedControl.push({
            nodeId,
            seedParams,
            controlValue
          });
        }
      }
    }

    if (nodesWithSeedControl.length === 0) {
      return;
    }
    
    // Process each node with seed control
    for (const {nodeId, seedParams, controlValue} of nodesWithSeedControl) {
      // Process each seed parameter
      for (const seedParam of seedParams) {
        const currentValue = seedParam.value;
        let newValue = currentValue;
        
        switch (controlValue) {
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
        
        // Save the new seed value
        await saveWidgetValue(workflowId, nodeId, seedParam.name, newValue);
      }
    }
  }, [getSeedControlSettings, saveWidgetValue]);

  return {
    saveWidgetValue,
    saveWidgetValuesBatch,
    getSeedControlSettings,
    setSeedControlSetting,
    applySeedControls,
    isLoading,
    lastSaveTime
  };
};