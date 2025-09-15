/**
 * Widget Type Manager Service
 * 
 * Handles CRUD operations for custom widget type definitions
 * via the comfy-mobile-ui-api-extension.
 */

import { WidgetTypeDefinition } from '@/shared/types/app/WidgetFieldTypes';
import ComfyApiClient from '@/infrastructure/api/ComfyApiClient';

export class WidgetTypeManager {
  /**
   * Get all custom widget types from server
   */
  static async getAllWidgetTypes(): Promise<WidgetTypeDefinition[]> {
    try {
      return await ComfyApiClient.getAllCustomWidgetTypes();
    } catch (error) {
      console.error('Error fetching custom widget types:', error);
      throw error;
    }
  }

  /**
   * Get a specific widget type by ID
   */
  static async getWidgetType(typeId: string): Promise<WidgetTypeDefinition | null> {
    try {
      return await ComfyApiClient.getCustomWidgetType(typeId);
    } catch (error) {
      console.error(`Error fetching custom widget type ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new widget type
   */
  static async createWidgetType(widgetType: WidgetTypeDefinition): Promise<WidgetTypeDefinition> {
    try {
      return await ComfyApiClient.createCustomWidgetType(widgetType);
    } catch (error) {
      console.error('Error creating custom widget type:', error);
      throw error;
    }
  }

  /**
   * Update an existing widget type
   */
  static async updateWidgetType(typeId: string, widgetType: WidgetTypeDefinition): Promise<WidgetTypeDefinition> {
    try {
      return await ComfyApiClient.updateCustomWidgetType(typeId, widgetType);
    } catch (error) {
      console.error(`Error updating custom widget type ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a widget type
   */
  static async deleteWidgetType(typeId: string): Promise<void> {
    try {
      await ComfyApiClient.deleteCustomWidgetType(typeId);
    } catch (error) {
      console.error(`Error deleting custom widget type ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Export widget type configuration as JSON
   */
  static exportWidgetType(widgetType: WidgetTypeDefinition): string {
    return JSON.stringify(widgetType, null, 2);
  }

  /**
   * Import widget type configuration from JSON
   */
  static importWidgetType(jsonString: string): WidgetTypeDefinition {
    try {
      const widgetType = JSON.parse(jsonString);
      
      // Basic validation
      if (!widgetType.id || !widgetType.name || !widgetType.fields) {
        throw new Error('Invalid widget type format: missing required fields');
      }
      
      return widgetType;
    } catch (error) {
      console.error('Error importing widget type:', error);
      throw new Error(`Failed to import widget type: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Validate widget type definition
   */
  static validateWidgetType(widgetType: WidgetTypeDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Required fields
    if (!widgetType.id?.trim()) {
      errors.push('Widget type ID is required');
    }
    
    if (!widgetType.fields || Object.keys(widgetType.fields).length === 0) {
      errors.push('At least one field is required');
    }
    
    // Validate field definitions
    if (widgetType.fields) {
      Object.entries(widgetType.fields).forEach(([fieldName, fieldConfig]) => {
        if (!fieldName.trim()) {
          errors.push('Field names cannot be empty');
        }
        
        if (!fieldConfig.label?.trim()) {
          errors.push(`Field "${fieldName}" must have a label`);
        }
        
        if (!fieldConfig.type) {
          errors.push(`Field "${fieldName}" must have a type`);
        }
        
        // Validate numeric constraints
        if (fieldConfig.type === 'float' || fieldConfig.type === 'int') {
          if (fieldConfig.min !== undefined && fieldConfig.max !== undefined && fieldConfig.min > fieldConfig.max) {
            errors.push(`Field "${fieldName}": min value cannot be greater than max value`);
          }
          
          if (fieldConfig.step !== undefined && fieldConfig.step <= 0) {
            errors.push(`Field "${fieldName}": step must be positive`);
          }
        }
        
        // Validate combo options
        if (fieldConfig.type === 'combo' && (!fieldConfig.options || fieldConfig.options.length === 0)) {
          errors.push(`Field "${fieldName}": combo type must have options`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate example widget type for LORA_CONFIG
   */
  static createLoraConfigExample(): WidgetTypeDefinition {
    return {
      id: 'LORA_CONFIG',
      description: 'Configuration for Power Lora Loader (rgthree)',
      tooltip: 'LoRA configuration with enable/disable, file selection, and dual strength controls',
      fields: {
        on: {
          type: 'boolean',
          label: 'Enabled',
          description: 'Enable or disable this LoRA',
          default: false
        },
        lora: {
          type: 'lora',
          label: 'LoRA File',
          description: 'Select a LoRA file'
        },
        strength: {
          type: 'float',
          label: 'Strength',
          description: 'Primary strength value for the LoRA',
          min: 0.0,
          max: 4.0,
          step: 0.1,
          default: 1.0
        },
        strengthTwo: {
          type: 'float',
          label: 'Strength Two',
          description: 'Secondary strength value for the LoRA',
          min: 0.0,
          max: 4.0,
          step: 0.1,
          default: 1.0
        }
      },
      defaultValue: {
        on: false,
        lora: '',
        strength: 1.0,
        strengthTwo: 1.0
      },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

// Convenience hooks for React components
export const useWidgetTypes = () => {
  const [widgetTypes, setWidgetTypes] = React.useState<WidgetTypeDefinition[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadWidgetTypes = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const types = await WidgetTypeManager.getAllWidgetTypes();
      setWidgetTypes(types);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load custom widget types');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWidgetType = React.useCallback(async (widgetType: WidgetTypeDefinition) => {
    try {
      const existingType = await WidgetTypeManager.getWidgetType(widgetType.id);
      
      if (existingType) {
        await WidgetTypeManager.updateWidgetType(widgetType.id, widgetType);
      } else {
        await WidgetTypeManager.createWidgetType(widgetType);
      }
      
      // Reload the list
      await loadWidgetTypes();
    } catch (err) {
      throw err; // Let the calling component handle the error
    }
  }, [loadWidgetTypes]);

  const deleteWidgetType = React.useCallback(async (typeId: string) => {
    try {
      await WidgetTypeManager.deleteWidgetType(typeId);
      await loadWidgetTypes();
    } catch (err) {
      throw err;
    }
  }, [loadWidgetTypes]);

  React.useEffect(() => {
    loadWidgetTypes();
  }, [loadWidgetTypes]);

  return {
    widgetTypes,
    loading,
    error,
    loadWidgetTypes,
    saveWidgetType,
    deleteWidgetType
  };
};

// Add React import for hooks
import React from 'react';