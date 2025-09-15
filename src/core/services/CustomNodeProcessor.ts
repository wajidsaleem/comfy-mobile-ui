/**
 * Custom Node Processor
 * 
 * This will be replaced with the dynamic widget system that allows users to define
 * custom node processing without hardcoding.
 * 
 * Usage:
 * - Add new custom node processors to the CUSTOM_NODE_PROCESSORS map
 * - Each processor receives the API node data and can modify it in-place
 * - Called during Step 9 of convertGraphToAPI in ComfyApiFunctions.ts
 */

export interface CustomNodeProcessor {
  /** Unique identifier for this processor */
  id: string;
  
  /** Display name for logging */
  name: string;
  
  /** ComfyUI class types this processor handles */
  classTypes: string[];
  
  /** Processing function that modifies the API node in-place */
  process: (nodeId: string, apiNode: any) => void;
  
  /** Optional description of what this processor does */
  description?: string;
}

// All hardcoded node processors removed - will be replaced with dynamic system

/**
 * Registry of all custom node processors
 * Will be populated dynamically based on user configurations
 */
const CUSTOM_NODE_PROCESSORS: CustomNodeProcessor[] = [
  // Dynamic processors will be registered here
];

/**
 * Main entry point for custom node processing
 * Called from convertGraphToAPI Step 9
 * 
 * @param apiWorkflow The complete API workflow object
 */
export function processCustomNodes(apiWorkflow: any): void {
  console.log('🚀 Starting custom node processing...');
  
  let processedCount = 0;
  
  for (const [nodeId, nodeData] of Object.entries(apiWorkflow)) {
    const apiNode = nodeData as any;
    const classType = apiNode.class_type;
    
    if (!classType) {
      console.warn(`⚠️ Node ${nodeId} missing class_type, skipping`);
      continue;
    }
    
    // Find matching processor for this class type
    const processor = CUSTOM_NODE_PROCESSORS.find(p => 
      p.classTypes.includes(classType)
    );
    
    if (processor) {
      console.log(`🔧 Found processor for ${classType}: ${processor.name}`);
      try {
        processor.process(nodeId, apiNode);
        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing node ${nodeId} with ${processor.name}:`, error);
      }
    }
  }
  
  console.log(`✅ Custom node processing complete: ${processedCount} nodes processed`);
}

/**
 * Get information about available processors
 * Useful for debugging and documentation
 */
export function getAvailableProcessors(): CustomNodeProcessor[] {
  return [...CUSTOM_NODE_PROCESSORS];
}

/**
 * Check if a class type has a custom processor
 */
export function hasProcessor(classType: string): boolean {
  return CUSTOM_NODE_PROCESSORS.some(p => p.classTypes.includes(classType));
}

/**
 * Add a new custom node processor at runtime
 * Useful for plugins or dynamic extension loading
 */
export function registerProcessor(processor: CustomNodeProcessor): void {
  // Check for duplicate IDs
  const existingProcessor = CUSTOM_NODE_PROCESSORS.find(p => p.id === processor.id);
  if (existingProcessor) {
    console.warn(`⚠️ Processor with ID ${processor.id} already exists, replacing...`);
    const index = CUSTOM_NODE_PROCESSORS.indexOf(existingProcessor);
    CUSTOM_NODE_PROCESSORS[index] = processor;
  } else {
    CUSTOM_NODE_PROCESSORS.push(processor);
  }
  
  console.log(`📝 Registered custom node processor: ${processor.name} (${processor.id})`);
}

/**
 * Remove a custom node processor by ID
 */
export function unregisterProcessor(processorId: string): boolean {
  const index = CUSTOM_NODE_PROCESSORS.findIndex(p => p.id === processorId);
  if (index >= 0) {
    const removed = CUSTOM_NODE_PROCESSORS.splice(index, 1)[0];
    console.log(`🗑️ Unregistered custom node processor: ${removed.name} (${removed.id})`);
    return true;
  }
  return false;
}

// Export the main processing function as default
export default processCustomNodes;