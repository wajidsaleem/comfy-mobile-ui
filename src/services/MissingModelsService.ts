/**
 * Service for detecting missing models in workflow nodes
 */

import type { IComfyGraphNode, IComfyWidget } from '@/shared/types/app/base';

export interface MissingModelInfo {
  nodeId: number;
  nodeType: string;
  nodeTitle?: string;
  widgetName: string;
  missingModel: string;
  availableModels: string[];
}

// Media file extensions that should not be treated as models
const MEDIA_EXTENSIONS = [
  // Video formats
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv',
  // Image formats
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'psd', 'raw',
  // Audio formats (in case)
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'
];

/**
 * Check if a value is likely a media file based on extension
 * @param value - The value to check
 * @returns true if the value appears to be a media file
 */
function isMediaFile(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Check if value has an extension
  const lastDotIndex = value.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === value.length - 1) {
    // No extension or ends with dot - might not be a file
    return false;
  }

  // Extract extension
  const extension = value.substring(lastDotIndex + 1).toLowerCase();

  // Check if it's a media extension
  return MEDIA_EXTENSIONS.includes(extension);
}

/**
 * Check if a value is likely a model file
 * @param value - The value to check
 * @returns true if the value appears to be a model file
 */
function isLikelyModelValue(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // If it's a media file, it's not a model
  if (isMediaFile(value)) {
    return false;
  }

  // Check for common model file extensions
  const modelExtensions = ['safetensors', 'ckpt', 'pt', 'pth', 'bin', 'onnx', 'gguf', 'ggml'];
  const lastDotIndex = value.lastIndexOf('.');

  if (lastDotIndex !== -1 && lastDotIndex !== value.length - 1) {
    const extension = value.substring(lastDotIndex + 1).toLowerCase();
    // If it has a model extension, it's likely a model
    if (modelExtensions.includes(extension)) {
      return true;
    }
  }

  // If no extension or unknown extension, assume it could be a model name
  // This handles cases like "sd_xl_base_1.0" or model names without extensions
  return lastDotIndex === -1;
}

/**
 * Detect missing models in workflow nodes by checking COMBO widgets
 * @param nodes - Array of graph nodes to check
 * @returns Array of missing model information
 */
export function detectMissingModels(nodes: IComfyGraphNode[]): MissingModelInfo[] {
  const missingModels: MissingModelInfo[] = [];

  if (!nodes || nodes.length === 0) {
    return missingModels;
  }

  for (const node of nodes) {
    // Access widgets through getter if available (for ComfyGraphNode class instances)
    const widgets = (node as any).widgets || (node as any)._widgets || [];

    // Skip if node doesn't have widgets
    if (!widgets || widgets.length === 0) {
      continue;
    }

    // Check each widget in the node
    for (const widget of widgets) {
      // Only check COMBO widgets that have options with values
      if (widget.type === 'COMBO' && widget.options?.values && Array.isArray(widget.options.values)) {
        // Check if the current value exists in the available values
        if (widget.value && !widget.options.values.includes(widget.value)) {
          // Skip if this doesn't look like a model value (e.g., media files)
          if (!isLikelyModelValue(widget.value)) {
            continue;
          }

          missingModels.push({
            nodeId: node.id,
            nodeType: node.type,
            nodeTitle: node.title,
            widgetName: widget.name,
            missingModel: widget.value,
            availableModels: widget.options.values
          });
        }
      }
    }
  }

  return missingModels;
}

/**
 * Format missing models for display
 * @param missingModels - Array of missing model info
 * @returns Formatted string for display
 */
export function formatMissingModelsMessage(missingModels: MissingModelInfo[]): string {
  if (missingModels.length === 0) {
    return '';
  }

  // Group by model name
  const modelGroups = new Map<string, MissingModelInfo[]>();
  for (const info of missingModels) {
    const existing = modelGroups.get(info.missingModel) || [];
    existing.push(info);
    modelGroups.set(info.missingModel, existing);
  }

  // Format message
  const messages: string[] = [];
  for (const [model, infos] of modelGroups) {
    const nodeRefs = infos.map(info =>
      `Node #${info.nodeId}${info.nodeTitle ? ` (${info.nodeTitle})` : ''} - ${info.widgetName}`
    );
    messages.push(`• ${model}: ${nodeRefs.join(', ')}`);
  }

  return messages.join('\n');
}

/**
 * Get unique missing model names
 * @param missingModels - Array of missing model info
 * @returns Array of unique model names
 */
export function getUniqueMissingModels(missingModels: MissingModelInfo[]): string[] {
  const uniqueModels = new Set<string>();
  for (const info of missingModels) {
    uniqueModels.add(info.missingModel);
  }
  return Array.from(uniqueModels);
}