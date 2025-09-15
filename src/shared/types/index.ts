/**
 * Shared Type Definitions
 * 
 * Export type definitions used across the application
 */

// ComfyUI related types (exported selectively to avoid duplicates)
export { ConnectionState } from './comfy/connection'
export { IComfyFileInfo, ComfyFileType } from './comfy/IComfyFile'
export { IObjectInfo, INodeWithMetadata, IProcessedParameter } from './comfy/IComfyObjectInfo'

// App internal types
export * from './app/base'
export * from './app/enums'