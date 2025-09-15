/**
 * Widget Value Serializer
 */

export interface WidgetValueSerializer {
  serialize: (value: any) => any;
  deserialize: (value: any) => any;
  validateValue: (value: any, type: string) => boolean;
}