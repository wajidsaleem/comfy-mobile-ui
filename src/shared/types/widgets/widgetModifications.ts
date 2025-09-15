/**
 * Types for widget value modifications stored in useWidgetValueEditor
 */

// Structure of node modifications object stored in modifiedWidgetValues Map
export interface NodeWidgetModifications {
  [paramName: string]: any; // Widget parameter values (string, number, boolean, array, object)
  _node_mode?: number; // Special key for node mode (0=ALWAYS, 2=MUTE, 4=BYPASS)
}

// Type for the complete modified widget values map
export type ModifiedWidgetValuesMap = Map<number, NodeWidgetModifications>;

// Helper type for widget parameter changes
export interface WidgetParameterChange {
  nodeId: number;
  paramName: string;
  oldValue: any;
  newValue: any;
}

// Helper type for node mode changes  
export interface NodeModeChange {
  nodeId: number;
  oldMode: number;
  newMode: number;
}