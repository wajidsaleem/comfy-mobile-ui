/**
 * Widget Field Type System
 * 
 * Defines the structure for dynamic widget field definitions
 * that users can configure through the UI.
 */

export type FieldType = 
  | 'boolean'
  | 'string' 
  | 'float'
  | 'int'
  | 'combo'
  | 'lora'       // LoRA file selection
  | 'model'      // Model file selection
  | 'embedding'; // Embedding file selection

export interface FieldConfig {
  type: FieldType;
  label: string;
  description?: string;
  
  // Validation constraints
  min?: number;
  max?: number;
  step?: number;
  
  // Options for combo type
  options?: string[];
  
  // Default value (only for boolean, string, float, int)
  default?: any;
  
  // UI hints
  placeholder?: string;
  multiline?: boolean;
}

export interface WidgetTypeDefinition {
  id: string;
  description?: string;
  
  // Default tooltip for widgets of this type
  tooltip?: string;
  
  // Field definitions
  fields: Record<string, FieldConfig>;
  
  // Default widget value structure
  defaultValue: Record<string, any>;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface WidgetTypeFormData {
  description: string;
  tooltip: string;
  fields: Array<{
    id: string;
    name: string;
    config: FieldConfig;
  }>;
}

export interface FieldTypeOption {
  value: FieldType;
  label: string;
  description: string;
  supportsValidation?: boolean;
  supportsOptions?: boolean;
  supportsDefault?: boolean;
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  {
    value: 'boolean',
    label: 'Boolean',
    description: 'Toggle switch (true/false)',
    supportsDefault: true
  },
  {
    value: 'string',
    label: 'String',
    description: 'Text input field',
    supportsDefault: true
  },
  {
    value: 'float',
    label: 'Float',
    description: 'Decimal number with slider',
    supportsValidation: true,
    supportsDefault: true
  },
  {
    value: 'int',
    label: 'Integer',
    description: 'Whole number input',
    supportsValidation: true,
    supportsDefault: true
  },
  {
    value: 'combo',
    label: 'Combo',
    description: 'Dropdown selection',
    supportsOptions: true
  },
  {
    value: 'lora',
    label: 'LoRA File',
    description: 'LoRA file selection from server'
  },
  {
    value: 'model',
    label: 'Model File',
    description: 'Model file selection from server'
  },
  {
    value: 'embedding',
    label: 'Embedding File',
    description: 'Embedding file selection from server'
  }
];