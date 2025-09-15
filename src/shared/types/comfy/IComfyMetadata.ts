/**
 * ComfyUI Node Metadata Types
 */

export interface INodeMetadata {
  class_type?: string
  description?: string
  name?: string
  display_name?: string
  python_module?: string
  deprecated?: boolean
  experimental?: boolean
  input?: {
    required?: Record<string, any>
    optional?: Record<string, any>
  }
  output?: string[]
  output_is_list?: boolean[]
  output_name?: string[]
  category?: string
  output_node?: boolean
}