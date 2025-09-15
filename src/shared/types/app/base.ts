/**
 * Base Comfy Graph type definitions for ComfyUI integration
 * Main export file that re-exports all types from separate files
 */

// Re-export all types from separate files
export * from './IComfyGraph'  // This includes all graph-related types
export * from './enums'
export * from './IComfyJson'  // This includes IComfyJsonNode
export * from './IComfyWorkflow'  // This includes all workflow-related types
export * from './INodeConnection'

// Export as global for compatibility
declare global {
  interface Window {
    ComfyGraph: any
  }
}

export default {}