/**
 * Chain Analyzer Service
 *
 * Provides functions to analyze API-formatted workflows and detect
 * input/output nodes for workflow chaining.
 */

import {
  IChainInputBinding,
  IChainOutputNode,
  ChainWidgetType,
  ChainOutputType,
  ChainInputBindingType
} from '@/core/chain/types';

/**
 * Detect input nodes in an API-formatted workflow
 *
 * Finds all nodes with image or video inputs that can be bound
 * to static files or dynamic outputs from other workflows.
 *
 * @param apiWorkflow - API-formatted workflow object
 * @returns Array of input binding configurations
 */
export function detectInputNodes(apiWorkflow: any): IChainInputBinding[] {
  const inputBindings: IChainInputBinding[] = [];

  if (!apiWorkflow || typeof apiWorkflow !== 'object') {
    console.warn('Invalid API workflow provided to detectInputNodes');
    return inputBindings;
  }

  // Iterate through all nodes in the API workflow
  for (const [nodeId, nodeData] of Object.entries(apiWorkflow)) {
    const node = nodeData as any;

    if (!node.inputs || typeof node.inputs !== 'object') {
      continue;
    }

    // Check each input in the node
    for (const [inputName, inputValue] of Object.entries(node.inputs)) {
      // Skip connected inputs (array format [nodeId, slotIndex])
      if (Array.isArray(inputValue)) {
        continue;
      }

      // Only match exact widget names "image" or "video"
      let widgetType: ChainWidgetType | null = null;

      if (inputName === 'image') {
        widgetType = 'image';
      } else if (inputName === 'video') {
        widgetType = 'video';
      }

      // If we detected a valid widget type, create binding
      if (widgetType) {
        // Get node title from _meta if available
        const nodeTitle = node._meta?.title || node.class_type || nodeId;

        inputBindings.push({
          nodeId: nodeId,
          widgetName: inputName,
          widgetType: widgetType,
          currentValue: typeof inputValue === 'string' ? inputValue : '',
          bindingType: 'static' as ChainInputBindingType,
          nodeTitle: nodeTitle
        } as any);
      }
    }
  }

  return inputBindings;
}

/**
 * Detect output nodes in an API-formatted workflow
 *
 * Finds all nodes that produce output files (have filename_prefix).
 * These can be connected as inputs to subsequent workflows.
 *
 * @param apiWorkflow - API-formatted workflow object
 * @returns Array of output node definitions
 */
export function detectOutputNodes(apiWorkflow: any): IChainOutputNode[] {
  const outputNodes: IChainOutputNode[] = [];

  if (!apiWorkflow || typeof apiWorkflow !== 'object') {
    console.warn('Invalid API workflow provided to detectOutputNodes');
    return outputNodes;
  }

  // Iterate through all nodes in the API workflow
  for (const [nodeId, nodeData] of Object.entries(apiWorkflow)) {
    const node = nodeData as any;

    if (!node.inputs || typeof node.inputs !== 'object') {
      continue;
    }

    // Check if node has filename_prefix input
    if ('filename_prefix' in node.inputs) {
      const filenamePrefix = node.inputs.filename_prefix;

      // Skip if save_output exists and is false
      if ('save_output' in node.inputs) {
        const saveOutput = node.inputs.save_output;
        if (saveOutput === false) {
          continue;
        }
      }

      // Determine output type based on class_type
      let outputType: ChainOutputType = 'image'; // Default to image

      if (node.class_type) {
        const classType = node.class_type.toLowerCase();

        // Check for video-related node types
        if (
          classType.includes('video') ||
          classType.includes('vhs') ||
          classType.includes('animate') ||
          classType.includes('gif')
        ) {
          outputType = 'video';
        }
      }

      // Get node title from _meta if available
      const nodeTitle = node._meta?.title || node.class_type || nodeId;

      outputNodes.push({
        nodeId: nodeId,
        filenamePrefix: typeof filenamePrefix === 'string' ? filenamePrefix : String(filenamePrefix),
        outputType: outputType,
        nodeTitle: nodeTitle
      } as any);
    }
  }

  return outputNodes;
}

/**
 * Analyze a workflow and return both input and output information
 *
 * @param apiWorkflow - API-formatted workflow object
 * @returns Object containing input bindings and output nodes
 */
export function analyzeWorkflow(apiWorkflow: any): {
  inputs: IChainInputBinding[];
  outputs: IChainOutputNode[];
} {
  return {
    inputs: detectInputNodes(apiWorkflow),
    outputs: detectOutputNodes(apiWorkflow)
  };
}