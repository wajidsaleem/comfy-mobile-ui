/**
 * Widget System Types
 */

export interface WidgetFactory {
  create: (type: string, options?: any) => any;
}

export interface WidgetIndexMapper {
  getParameterOrder: (nodeType: string) => string[];
}

export interface WidgetValueSerializer {
  serialize: (value: any) => any;
  deserialize: (value: any) => any;
}

// Re-export for compatibility
export { WidgetFactory as default } from './index';