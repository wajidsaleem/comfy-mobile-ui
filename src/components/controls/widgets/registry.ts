/**
 * Widget Registry System
 * 
 * Automatically collects all supported types from widget components
 * and provides dynamic editableTypes for WidgetValueEditor
 */

import { NumberWidgetSupportedTypes } from './NumberWidget';
import { BooleanWidgetSupportedTypes } from './BooleanWidget';
import { StringWidgetSupportedTypes } from './StringWidget';
import { ComboWidgetSupportedTypes } from './ComboWidget';
import { SeedWithControlWidgetSupportedTypes } from './SeedWithControlWidget';

/**
 * Collect all supported types from widget components
 */
const allSupportedTypes = [
  ...NumberWidgetSupportedTypes,
  ...BooleanWidgetSupportedTypes,
  ...StringWidgetSupportedTypes,
  ...ComboWidgetSupportedTypes,
  ...SeedWithControlWidgetSupportedTypes,
] as const;

/**
 * Get all editable types supported by widget components
 * This automatically includes all types that have corresponding widget components
 */
export function getEditableTypes(): string[] {
  return [...allSupportedTypes];
}

/**
 * Check if a parameter type is editable (has a corresponding widget component)
 */
export function isParameterTypeEditable(paramType: string): boolean {
  return allSupportedTypes.includes(paramType.toUpperCase() as any);
}

/**
 * Get summary of registered widget types
 */
export function getWidgetRegistrySummary() {
  return {
    totalTypes: allSupportedTypes.length,
    numberTypes: NumberWidgetSupportedTypes.length,
    booleanTypes: BooleanWidgetSupportedTypes.length,
    stringTypes: StringWidgetSupportedTypes.length,
    comboTypes: ComboWidgetSupportedTypes.length,
    seedControlTypes: SeedWithControlWidgetSupportedTypes.length,
    allTypes: [...allSupportedTypes]
  };
}