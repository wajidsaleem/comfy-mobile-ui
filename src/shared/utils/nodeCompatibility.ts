import { WorkflowNode } from '@/shared/types/app/IComfyWorkflow';

/**
 * Node connection compatibility utilities
 * 
 * Rules:
 * 1. Slot compatibility is checked by string matching between types
 * 2. "*" type is compatible with any type
 * 3. Type comparison is case-insensitive (MODEL = model = Model)
 * 4. If originalType field exists (from node patch), use that for compatibility check
 */

export interface NodeSlot {
  name: string;
  type: string | string[]; // Support both string and array types (for selectable options)
  originalType?: string | string[]; // From node patch functionality
  link?: number | null;
  links?: number[] | null;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  compatibleConnections: Array<{
    sourceSlot: number;
    targetSlot: number;
    sourceSlotName: string;
    targetSlotName: string;
    connectionType: string | string[];
    isReplacement?: boolean;
  }>;
}

/**
 * Parse comma-separated types into individual types
 */
function parseTypesFromString(typeString: string): string[] {
  return typeString
    .split(',')
    .map(type => type.trim())
    .filter(type => type.length > 0);
}

/**
 * Check if two slot types are compatible
 */
export function areSlotTypesCompatible(outputType: string | string[], inputType: string | string[]): boolean {
  // Handle array types (typically from node metadata definitions)
  let effectiveOutputType = Array.isArray(outputType) ? outputType : [String(outputType || '')];
  let effectiveInputType = Array.isArray(inputType) ? inputType : [String(inputType || '')];

  // Parse comma-separated types for non-array string types
  if (!Array.isArray(outputType) && typeof outputType === 'string' && outputType.includes(',')) {
    effectiveOutputType = parseTypesFromString(outputType);
  }
  if (!Array.isArray(inputType) && typeof inputType === 'string' && inputType.includes(',')) {
    effectiveInputType = parseTypesFromString(inputType);
  }

  // Skip empty types
  if (effectiveOutputType.length === 0 || effectiveInputType.length === 0) {
    return false;
  }

  // If output type is an array (indicating selectable options), check if input accepts COMBO
  if (Array.isArray(outputType) && !Array.isArray(inputType)) {
    const inputTypeStr = String(inputType || '').toLowerCase();
    // Array output types can connect to COMBO inputs
    if (inputTypeStr === 'combo') {
      return true;
    }
  }

  // If input type is an array (indicating selectable options), check if output is COMBO
  if (Array.isArray(inputType) && !Array.isArray(outputType)) {
    const outputTypeStr = String(outputType || '').toLowerCase();
    // COMBO output types can connect to array input types
    if (outputTypeStr === 'combo') {
      return true;
    }
  }

  // Check each output type against each input type
  for (const outType of effectiveOutputType) {
    const outTypeStr = String(outType || '').toLowerCase();

    // Skip empty types
    if (!outTypeStr) continue;

    for (const inType of effectiveInputType) {
      const inTypeStr = String(inType || '').toLowerCase();

      // Skip empty types
      if (!inTypeStr) continue;

      // "*" type is compatible with everything
      if (outTypeStr === '*' || inTypeStr === '*') {
        return true;
      }

      // Case-insensitive string comparison
      if (outTypeStr === inTypeStr) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get the effective type for compatibility checking
 * Prioritizes originalType if available (from node patch)
 */
export function getEffectiveSlotType(slot: NodeSlot): string | string[] {
  if (!slot) return '';

  // Use originalType if available (from node patch), otherwise use type
  const type = slot.originalType || slot.type;

  // Return as-is if it's already an array (for selectable options)
  if (Array.isArray(type)) {
    return type;
  }

  // Ensure we return a string for non-array types
  return String(type || '');
}

/**
 * Check if a source node can connect to a target node
 * Returns all possible compatible connections
 */
export function checkNodeCompatibility(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode
): CompatibilityResult {
  const compatibleConnections: CompatibilityResult['compatibleConnections'] = [];
  
  // Get source node outputs
  const sourceOutputs = sourceNode.outputs || [];
  
  // Get target node inputs  
  const targetInputs = targetNode.inputs || [];
  
  console.log(`Checking compatibility between ${sourceNode.type}(${sourceNode.id}) -> ${targetNode.type}(${targetNode.id})`);
  console.log('Source outputs:', sourceOutputs);
  console.log('Target inputs:', targetInputs);
  
  // Check each output against each input
  sourceOutputs.forEach((output, sourceSlotIndex) => {
    const sourceType = getEffectiveSlotType(output as NodeSlot);
    
    targetInputs.forEach((input, targetSlotIndex) => {
      const targetType = getEffectiveSlotType(input as NodeSlot);
      
      console.log(`Checking slot ${sourceSlotIndex}(${sourceType}) -> slot ${targetSlotIndex}(${targetType})`);
      
      // Check compatibility (allow connections to already connected slots if types match)
      if (areSlotTypesCompatible(sourceType, targetType)) {
        console.log('  MATCH FOUND!');
        const isAlreadyConnected = input.link !== null && input.link !== undefined;
        compatibleConnections.push({
          sourceSlot: sourceSlotIndex,
          targetSlot: targetSlotIndex,
          sourceSlotName: output.name || `Output ${sourceSlotIndex}`,
          targetSlotName: input.name || `Input ${targetSlotIndex}`,
          connectionType: sourceType === '*' ? targetType : sourceType,
          isReplacement: isAlreadyConnected,
        });
        if (isAlreadyConnected) {
          console.log('  Note: This connection will replace existing link');
        }
      }
    });
  });
  
  console.log(`Total compatible connections: ${compatibleConnections.length}`);
  
  return {
    isCompatible: compatibleConnections.length > 0,
    compatibleConnections,
  };
}

/**
 * Find all nodes compatible with a given source node
 * Returns Set of compatible node IDs
 */
export function findCompatibleNodes(
  sourceNode: WorkflowNode,
  allNodes: WorkflowNode[]
): Set<number> {
  const compatibleNodeIds = new Set<number>();
  
  allNodes.forEach((targetNode) => {
    // Skip self
    if (targetNode.id === sourceNode.id) {
      return;
    }
    
    // Skip nodes that have no input slots (cannot be target nodes)
    if (!hasInputSlots(targetNode)) {
      return;
    }
    
    const compatibility = checkNodeCompatibility(sourceNode, targetNode);
    if (compatibility.isCompatible) {
      compatibleNodeIds.add(targetNode.id);
    }
  });
  
  return compatibleNodeIds;
}

/**
 * Check if an input slot is available (not already connected)
 */
export function isInputSlotAvailable(slot: NodeSlot): boolean {
  return slot.link === null || slot.link === undefined;
}

/**
 * Get all available input slots for a node
 */
export function getAvailableInputSlots(node: WorkflowNode): Array<{
  index: number;
  slot: NodeSlot;
}> {
  const inputs = node.inputs || [];
  
  return inputs
    .map((input, index) => ({ index, slot: input as NodeSlot }))
    .filter(({ slot }) => isInputSlotAvailable(slot));
}

/**
 * Get all output slots for a node
 */
export function getOutputSlots(node: WorkflowNode): Array<{
  index: number;
  slot: NodeSlot;
}> {
  const outputs = node.outputs || [];
  
  return outputs.map((output, index) => ({ index, slot: output as NodeSlot }));
}

/**
 * Check if a node has any output slots (can be used as source node)
 */
export function hasOutputSlots(node: WorkflowNode): boolean {
  const outputs = node.outputs || [];
  return Array.isArray(outputs) && outputs.length > 0;
}

/**
 * Check if a node has any input slots (can be used as target node)
 */
export function hasInputSlots(node: WorkflowNode): boolean {
  const inputs = node.inputs || [];
  return Array.isArray(inputs) && inputs.length > 0;
}