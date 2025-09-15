/**
 * Widget Index Mapper
 */

export interface WidgetIndexMapper {
  getParameterOrder: (nodeType: string) => string[];
  mapWidgetIndex: (nodeType: string, paramName: string) => number;
}