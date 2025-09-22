// Shared canvas rendering functions for workflow visualization
// Used by both detail view and thumbnail generation

import type { IComfyGraphNode, IComfyGraphLink } from '@/shared/types/app/base';
import { DEFAULT_CANVAS_CONFIG, CanvasConfig } from '@/config/canvasConfig';
import { IComfyGraphGroup } from '@/shared/types/app/base';

// Alias for backward compatibility
type IGroup = IComfyGraphGroup;

// Note: ComfyGraphNode can have Float32Array for pos and size when using LiteGraph
// The rendering functions handle both Float32Array and regular arrays

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  node: IComfyGraphNode;
}

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;  
  title?: string;
  color: string;
  id?: number; // Group ID for identification and selection
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface LongPressState {
  isActive: boolean;
  showProgress: boolean; // Separate flag for showing progress after 0.3s delay
  startTime: number;
  startX: number;
  startY: number;
  targetNode?: any | null; // WorkflowNode type
  timeoutId?: NodeJS.Timeout | null;
  progressTimeoutId?: NodeJS.Timeout | null; // For the 0.3s delay
  animationId?: number | null;
}

export interface RenderingOptions {
  selectedNode?: IComfyGraphNode | null;
  executingNodeId?: string | null;
  errorNodeId?: string | null;
  nodeExecutionProgress?: { nodeId: string; progress: number } | null;
  showText?: boolean; // Whether to render node titles and text (default: true)
  viewportScale?: number; // Viewport scale for responsive font sizing
  modifiedNodeIds?: Set<number>; // Nodes with temporary widget changes
  repositionMode?: {
    isActive: boolean;
    selectedNodeId: number | null;
    selectedGroupId: number | null;
    gridSnapEnabled: boolean;
    resizeMode?: {
      isActive: boolean;
      gripperType: 'corner' | 'edge';
      gripperPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
      originalSize: [number, number];
      originalPosition: [number, number];
    };
  } | null; // Repositioning mode information
  connectionMode?: {
    isActive: boolean;
    phase: 'SOURCE_SELECTION' | 'TARGET_SELECTION' | 'SLOT_SELECTION';
    sourceNodeId: number | null;
    targetNodeId: number | null;
    compatibleNodeIds: Set<number>;
  } | null; // Connection mode information for node highlighting
  missingNodeIds?: Set<number>; // Nodes with missing types (not available on server)
  longPressState?: LongPressState | null; // Long press visual feedback
}

/**
 * Helper function to darken or lighten a color
 * @param color - Hex color string
 * @param amount - Positive values darken, negative values lighten
 */
export function darkenColor(color: string, amount: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r = 0, g = 0, b = 0;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    if (amount >= 0) {
      // Darken by reducing RGB values
      r = Math.max(0, Math.round(r * (1 - amount)));
      g = Math.max(0, Math.round(g * (1 - amount)));
      b = Math.max(0, Math.round(b * (1 - amount)));
    } else {
      // Lighten by increasing RGB values towards 255
      const lightenAmount = Math.abs(amount);
      r = Math.min(255, Math.round(r + (255 - r) * lightenAmount));
      g = Math.min(255, Math.round(g + (255 - g) * lightenAmount));
      b = Math.min(255, Math.round(b + (255 - b) * lightenAmount));
    }
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  // Return original color if unable to process
  return color;
}

// Note: enhanceNodeColor function removed for performance optimization

// Note: getOptimalTextColor function removed for performance optimization - using fixed white text

/**
 * Calculate bounds for all workflow elements
 */
export function calculateAllBounds(
  nodes: IComfyGraphNode[], 
  groups?: IGroup[],
  config: CanvasConfig = DEFAULT_CANVAS_CONFIG,
  canvasWidth?: number,
  canvasHeight?: number
): { nodeBounds: Map<number, NodeBounds>; groupBounds: GroupBounds[] } {
  const nodeBounds = new Map<number, NodeBounds>();
  const groupBounds: GroupBounds[] = [];

  if (!nodes || nodes.length === 0) {
    return { nodeBounds, groupBounds };
  }

  // Calculate actual bounds to determine scaling
  const allElements: Array<{ x: number; y: number; width: number; height: number }> = [];

  // Add node positions with actual sizes
  for (const node of nodes) {
    let x = 0, y = 0;
    let width = config.nodeWidth;
    let height = config.nodeHeight;
    
    // Handle both Float32Array and regular arrays for position
    // Check all possible position properties
    const position = (node as any)._pos || node.pos || (node as any).position;
    if (position && (position instanceof Float32Array || Array.isArray(position)) && position.length >= 2) {
      // Use first two values as x,y position (works with both Float32Array and regular array)
      x = position[0];
      y = position[1];
    } else {
      // Fallback: arrange nodes in a grid
      const index = nodes.indexOf(node);
      const cols = Math.ceil(Math.sqrt(nodes.length));
      x = (index % cols) * 300;
      y = Math.floor(index / cols) * 200;
      console.warn(`⚠️ Node ${node.id} has no position, using grid fallback:`, {x, y});
    }

    // Handle both Float32Array and regular arrays for size
    // Check all possible size properties
    const nodeSize = (node as any)._size || node.size;
    if (nodeSize && (nodeSize instanceof Float32Array || Array.isArray(nodeSize)) && nodeSize.length >= 2) {
      width = Math.max(nodeSize[0], config.nodeWidth);
      height = Math.max(nodeSize[1], config.nodeHeight);
    }

    // Check if node is collapsed
    const isCollapsed = node.flags?.collapsed === true;
    if (isCollapsed) {
      width = 80;  // Fixed smaller width for collapsed nodes
      height = 30; // Fixed smaller height for collapsed nodes
    }

    allElements.push({ x, y, width, height });
  }

  // Add group bounds if available
  if (groups) {
    for (const group of groups) {
      // LiteGraph runtime uses _bounding, serialized uses bounding
      const bounding = (group as any)._bounding || group.bounding;
      if (!bounding) continue;
      
      const [gx, gy, gw, gh] = bounding;
      allElements.push({ x: gx, y: gy, width: gw, height: gh });
    }
  }

  if (allElements.length === 0) {
    return { nodeBounds, groupBounds };
  }

  // Calculate content bounds
  const minX = Math.min(...allElements.map(el => el.x));
  const minY = Math.min(...allElements.map(el => el.y));  
  const maxX = Math.max(...allElements.map(el => el.x + el.width));
  const maxY = Math.max(...allElements.map(el => el.y + el.height));

  // Calculate scaling only if canvas dimensions are provided (for thumbnails)
  let scale = 1;
  if (canvasWidth && canvasHeight) {
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const availableWidth = canvasWidth - 2 * config.padding;
    const availableHeight = canvasHeight - 2 * config.padding;

    const scaleX = contentWidth > 0 ? availableWidth / contentWidth : 1;
    const scaleY = contentHeight > 0 ? availableHeight / contentHeight : 1;
    scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
  }

  // Apply scaling to nodes  
  for (const node of nodes) {
    let x = 0, y = 0;
    let width = config.nodeWidth;
    let height = config.nodeHeight;
    
    // Handle both Float32Array and regular arrays for position
    // Check all possible position properties
    const position = (node as any)._pos || node.pos || (node as any).position;
    if (position && (position instanceof Float32Array || Array.isArray(position)) && position.length >= 2) {
      // Use first two values as x,y position (works with both Float32Array and regular array)
      x = position[0];
      y = position[1];
    } else {
      // Fallback positioning
      const index = nodes.indexOf(node);
      const cols = Math.ceil(Math.sqrt(nodes.length));
      x = (index % cols) * 300;
      y = Math.floor(index / cols) * 200;
    }

    // Handle both Float32Array and regular arrays for size
    // Check all possible size properties
    const nodeSize = (node as any)._size || node.size;
    if (nodeSize && (nodeSize instanceof Float32Array || Array.isArray(nodeSize)) && nodeSize.length >= 2) {
      width = Math.max(nodeSize[0], config.nodeWidth);
      height = Math.max(nodeSize[1], config.nodeHeight);
    }

    // Check if collapsed
    const isCollapsed = node.flags?.collapsed === true;
    if (isCollapsed) {
      width = 80;  // Fixed smaller width for collapsed nodes
      height = 30; // Fixed smaller height for collapsed nodes
    }

    const scaledX = canvasWidth ? (x - minX) * scale + config.padding : x;
    const scaledY = canvasHeight ? (y - minY) * scale + config.padding : y;
    
    nodeBounds.set(node.id, {
      x: scaledX,
      y: scaledY,
      width: width * scale,
      height: height * scale,
      node
    });
  }

  // Apply scaling to groups
  if (groups) {
    for (const group of groups) {
      // LiteGraph runtime uses _bounding, serialized uses bounding
      const bounding = (group as any)._bounding || group.bounding;
      if (!bounding) continue;
      
      const [gx, gy, gw, gh] = bounding;
      
      // Use original group position and size without scaling
      const baseScaledX = gx;
      const baseScaledY = gy;
      const baseScaledWidth = gw;
      const baseScaledHeight = gh;
      
      const scaledX = canvasWidth ? (baseScaledX - minX) * scale + config.padding : baseScaledX;
      const scaledY = canvasHeight ? (baseScaledY - minY) * scale + config.padding : baseScaledY;
      const scaledWidth = baseScaledWidth * scale;
      const scaledHeight = baseScaledHeight * scale;

      groupBounds.push({
        x: scaledX,
        y: scaledY,
        width: scaledWidth,
        height: scaledHeight,
        title: group.title || '',
        color: group.color || config.groupColor,
      });
    }
  }

  return { nodeBounds, groupBounds };
}

/**
 * Render groups to canvas
 */
export function renderGroups(
  ctx: CanvasRenderingContext2D,
  groupBounds: GroupBounds[],
  config: CanvasConfig = DEFAULT_CANVAS_CONFIG,
  showText: boolean = true,
  viewportScale?: number,
  repositionMode?: {
    isActive: boolean;
    selectedNodeId: number | null;
    selectedGroupId: number | null;
    gridSnapEnabled: boolean;
    resizeMode?: {
      isActive: boolean;
      gripperType: 'corner' | 'edge';
      gripperPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
      originalSize: [number, number];
      originalPosition: [number, number];
    };
  } | null
): void {
  for (const group of groupBounds) {
    // Draw group background with slight transparency (no border)
    ctx.fillStyle = group.color + '80'; // Add 50% opacity
    ctx.fillRect(group.x, group.y, group.width, group.height);

    // Draw selection outline if this group is selected in repositioning mode
    if (repositionMode?.isActive && group.id !== undefined && repositionMode.selectedGroupId === group.id) {
      ctx.strokeStyle = '#3B82F6'; // Blue color (same as node selection)
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(group.x, group.y, group.width, group.height);
    }

    // Draw group title (only if showText is enabled)
    if (showText && group.title) {
      ctx.fillStyle = config.groupTextColor;
      
      // Calculate responsive font size for group title (same logic as node text)
      let groupFontSize = config.groupFontSize; // Default fallback
      
      if (viewportScale !== undefined) {
        // Linear interpolation from 0% to 80% (same as node text)
        const maxScale = 0.8;   // 80%
        const minFontSize = 52; // Font size at 0% (slightly larger than node text)
        const maxFontSize = 12; // Font size at 80%+ (slightly larger than node text)
        
        let fontSize: number;
        if (viewportScale >= maxScale) {
          fontSize = maxFontSize;
        } else {
          const progress = viewportScale / maxScale;
          fontSize = minFontSize - (progress * (minFontSize - maxFontSize));
        }
        
        groupFontSize = Math.max(12, Math.min(60, fontSize));
      }
      
      ctx.font = `bold ${groupFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Position title at top-left of group with padding
      const titleX = group.x + 8;
      const titleY = group.y + 8;
      const maxTextWidth = group.width - 16; // Account for padding on both sides
      
      // Truncate text if too long (similar to node text logic)
      let truncatedTitle = group.title;
      const textMetrics = ctx.measureText(group.title);
      if (textMetrics.width > maxTextWidth) {
        // Truncate with ellipsis
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        const availableWidth = maxTextWidth - ellipsisWidth;
        
        let truncated = group.title;
        while (ctx.measureText(truncated).width > availableWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        truncatedTitle = truncated + ellipsis;
      }
      
      ctx.fillText(truncatedTitle, titleX, titleY);
    }

    // Draw resize grippers if this group is selected in repositioning mode
    if (repositionMode?.isActive && group.id !== undefined &&
        repositionMode.selectedGroupId === group.id && !repositionMode?.resizeMode?.isActive) {
      drawResizeGrippers(
        ctx,
        group.x,
        group.y,
        group.width,
        group.height,
        viewportScale || 1
      );
    }
  }
}

/**
 * Calculate slot position on a node
 */
function getSlotPosition(
  nodeBounds: NodeBounds,
  slotIndex: number,
  slotCount: number,
  isOutput: boolean,
  isCollapsed: boolean = false
): { x: number; y: number } {
  // For collapsed nodes, always center the single slot
  if (isCollapsed) {
    const y = nodeBounds.y + nodeBounds.height / 2;
    const x = isOutput ? nodeBounds.x + nodeBounds.width : nodeBounds.x;
    return { x, y };
  }
  
  const slotHeight = 20; // Height per slot
  const topMargin = nodeBounds.height * 0.05; // 5% from top
  
  // Calculate Y position - slots start from top margin, evenly spaced
  const y = nodeBounds.y + topMargin + (slotIndex * slotHeight) + (slotHeight / 2);
  
  // X position depends on whether it's input (left) or output (right)
  const x = isOutput ? nodeBounds.x + nodeBounds.width : nodeBounds.x;
  
  return { x, y };
}

/**
 * Render workflow links/connections to canvas
 */
export function renderConnections(
  ctx: CanvasRenderingContext2D,
  links: number[][] | IComfyGraphLink[],
  nodeBounds: Map<number, NodeBounds>,
  config: CanvasConfig = DEFAULT_CANVAS_CONFIG
): void {
  ctx.strokeStyle = config.linkColor;
  ctx.lineWidth = 2.5; // Increased from 1.5 to 2.5
  ctx.setLineDash([]);

  for (const link of links) {
    let sourceNodeId: number, sourceSlot: number, targetNodeId: number, targetSlot: number;
    
    // Handle both array and object formats
    if (Array.isArray(link) && link.length >= 5) {
      // Array format: [linkId, sourceNodeId, sourceSlot, targetNodeId, targetSlot, type]
      [, sourceNodeId, sourceSlot, targetNodeId, targetSlot] = link;
    } else if (typeof link === 'object' && link !== null) {
      // Object format: { id, origin_id, origin_slot, target_id, target_slot, type }
      const linkObj = link as IComfyGraphLink;
      sourceNodeId = linkObj.origin_id;
      sourceSlot = linkObj.origin_slot;
      targetNodeId = linkObj.target_id;
      targetSlot = linkObj.target_slot;
      
    } else {
      console.warn('🔗 Skipping invalid link:', link);
      continue;
    }
    const sourceBounds = nodeBounds.get(sourceNodeId);
    const targetBounds = nodeBounds.get(targetNodeId);

    if (!sourceBounds || !targetBounds) {
      continue;
    }
    

    // Get the actual nodes to access slot information
    const sourceNode = sourceBounds.node;
    const targetNode = targetBounds.node;
    
    // Check if nodes are collapsed
    const sourceCollapsed = sourceNode.flags?.collapsed === true;
    const targetCollapsed = targetNode.flags?.collapsed === true;
    
    // For expanded nodes, calculate the visual index among connected slots only
    let sourceVisualIndex = sourceSlot;
    let targetVisualIndex = targetSlot;
    
    if (!sourceCollapsed && sourceNode.outputs) {
      // Count connected outputs before this slot
      let connectedCount = 0;
      for (let i = 0; i < sourceSlot; i++) {
        if (sourceNode.outputs[i]?.links && sourceNode.outputs[i].links!.length > 0) {
          connectedCount++;
        }
      }
      sourceVisualIndex = connectedCount;
    }
    
    if (!targetCollapsed && targetNode.inputs) {
      // Count connected inputs before this slot
      let connectedCount = 0;
      for (let i = 0; i < targetSlot; i++) {
        if (targetNode.inputs[i]?.link) {
          connectedCount++;
        }
      }
      targetVisualIndex = connectedCount;
    }
    
    // Calculate actual slot positions using visual indices
    const sourcePos = getSlotPosition(
      sourceBounds,
      sourceVisualIndex,
      sourceNode.outputs?.length || 1,
      true, // is output
      sourceCollapsed
    );
    
    const targetPos = getSlotPosition(
      targetBounds,
      targetVisualIndex,
      targetNode.inputs?.length || 1,
      false, // is input
      targetCollapsed
    );

    // Draw bezier curve connection
    ctx.beginPath();
    ctx.moveTo(sourcePos.x, sourcePos.y);
    
    const controlPointOffset = Math.abs(targetPos.x - sourcePos.x) * 0.5;
    const cp1X = sourcePos.x + controlPointOffset;
    const cp1Y = sourcePos.y;
    const cp2X = targetPos.x - controlPointOffset;
    const cp2Y = targetPos.y;
    
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetPos.x, targetPos.y);
    ctx.stroke();
  }
}

/**
 * Render workflow nodes to canvas
 */
export function renderNodes(
  ctx: CanvasRenderingContext2D,
  nodes: IComfyGraphNode[],
  nodeBounds: Map<number, NodeBounds>,
  config: CanvasConfig = DEFAULT_CANVAS_CONFIG,
  options: RenderingOptions = {}
): void {
  const { selectedNode, executingNodeId, errorNodeId, nodeExecutionProgress, showText = true, viewportScale, modifiedNodeIds, repositionMode, connectionMode, missingNodeIds, longPressState } = options;

  // Sort nodes by collapsed state first, then connection mode priority, then by order
  // Lower values are drawn first (behind), higher values are drawn last (in front)
  const sortedNodes = [...nodes].sort((a, b) => {
    const aCollapsed = a.flags?.collapsed === true;
    const bCollapsed = b.flags?.collapsed === true;
    
    // If one is collapsed and the other isn't, collapsed goes first (behind)
    if (aCollapsed && !bCollapsed) return -1;
    if (!aCollapsed && bCollapsed) return 1;
    
    // Connection mode z-order priority (higher priority = drawn later = on top)
    const getConnectionPriority = (node: any) => {
      if (!connectionMode?.isActive) return 0;
      
      // Source and target nodes get highest priority
      if (connectionMode.sourceNodeId === node.id) return 1000;
      if (connectionMode.targetNodeId === node.id) return 1000;
      
      // Compatible nodes get medium priority (above normal nodes, below source/target)
      if (connectionMode.phase === 'TARGET_SELECTION' && 
          connectionMode.compatibleNodeIds.has(node.id) &&
          connectionMode.sourceNodeId !== node.id) {
        return 500;
      }
      
      return 0;
    };
    
    const aPriority = getConnectionPriority(a);
    const bPriority = getConnectionPriority(b);
    
    // If connection priorities are different, use them
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If both have same collapsed state and connection priority, sort by order (execution/drawing order)
    const aOrder = a.order || 0;
    const bOrder = b.order || 0;
    return aOrder - bOrder;  // Lower order = drawn first (behind)
  });

  for (const node of sortedNodes) {
    const bounds = nodeBounds.get(node.id);
    if (!bounds) continue;

    const isSelected = selectedNode?.id === node.id;
    const isRepositionSelected = repositionMode?.isActive && repositionMode?.selectedNodeId === node.id;
    
    // Connection mode highlighting logic
    const isConnectionSourceSelected = connectionMode?.isActive && connectionMode?.sourceNodeId === node.id;
    const isConnectionTargetSelected = connectionMode?.isActive && connectionMode?.targetNodeId === node.id;
    const isConnectionCompatible = connectionMode?.isActive && 
      connectionMode?.phase === 'TARGET_SELECTION' && 
      connectionMode?.compatibleNodeIds.has(node.id) &&
      connectionMode?.sourceNodeId !== node.id; // Don't highlight source as compatible target
    const isCollapsed = node.flags?.collapsed === true;
    const isExecuting = executingNodeId === String(node.id);
    const isError = errorNodeId === String(node.id);
    const isMuted = node.mode === 2; // Mode 2 = Mute/Never
    const isBypassed = node.mode === 4; // Mode 4 = Bypass
    const isInactive = isMuted || isBypassed; // Both muted and bypassed are inactive
    const hasModifications = modifiedNodeIds?.has(node.id) || false;
    const isMissingNodeType = missingNodeIds?.has(node.id) || false;
    
    // Save context state for opacity
    ctx.save();
    
    // Apply 35% opacity for inactive nodes (muted or bypassed)
    if (isInactive) {
      ctx.globalAlpha = 0.35;
    }
    
    // No shadows for better performance
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Use simple, solid colors for better performance
    let backgroundColor = config.defaultNodeColor;
    
    // Inactive nodes get special colors
    if (isMuted) {
      backgroundColor = '#3b82f6'; // Blue color for muted nodes
    } else if (isBypassed) {
      backgroundColor = '#9333ea'; // Purple color for bypassed nodes
    } else if (isExecuting) {
      // Executing nodes get green background color
      backgroundColor = '#10b981'; // Green background for executing nodes
    } else {
      if (node.bgcolor) {
        backgroundColor = node.bgcolor;
      } else {
        backgroundColor = '#2e2e2e';
      }
      
      // Simple state modifications without complex color enhancement
      if (isSelected) {
        backgroundColor = config.selectedNodeColor;
      } else if (isConnectionSourceSelected) {
        backgroundColor = '#1e40af'; // Blue background for selected source node
      } else if (isConnectionTargetSelected) {
        backgroundColor = '#dc2626'; // Red background for selected target node
      } else if (isConnectionCompatible) {
        backgroundColor = '#22c55e'; // Light green for compatible target nodes
      } else if (isCollapsed) {
        backgroundColor = darkenColor(backgroundColor, 0.15); // Simple darkening for collapsed
      }
    }

    // Simple rectangular nodes for maximum performance
    const cornerRadius = 4; // Minimal rounding to reduce GPU load
    
    {
      // Check if node is executing and has progress for gradient background
      const hasProgress = isExecuting && nodeExecutionProgress?.nodeId === String(node.id);
      
      if (hasProgress) {
        const currentProgress = nodeExecutionProgress.progress;
        const progressRatio = Math.max(0, Math.min(1, currentProgress / 100));
        
        // Create horizontal gradient for progress
        const gradient = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y);
        const baseGreen = '#10b981';    // Base green for executing nodes
        const lighterGreen = darkenColor(baseGreen, -0.3); // Lighter version of same color (negative = brighter)
        
        // Add gradient stops based on progress
        if (progressRatio > 0) {
          gradient.addColorStop(0, lighterGreen);
          if (progressRatio < 1) {
            gradient.addColorStop(progressRatio, lighterGreen);
            gradient.addColorStop(progressRatio, baseGreen);
          }
        }
        if (progressRatio < 1) {
          gradient.addColorStop(1, baseGreen);
        }
        
        ctx.fillStyle = gradient;
      } else {
        // Draw simple solid background
        ctx.fillStyle = backgroundColor;
      }
      
      ctx.beginPath();
      ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, cornerRadius);
      ctx.fill();
    }

    // Always draw subtle white outline for all nodes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // 20% opacity white
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, cornerRadius);
    ctx.stroke();

    // Additional border for special states
    if (isSelected || isError || hasModifications || isRepositionSelected || 
        isConnectionSourceSelected || isConnectionTargetSelected || isConnectionCompatible || isMissingNodeType) {
      let strokeColor = '#ffffff'; // Simple white for selected
      let lineWidth = 2;
      
      if (isMissingNodeType) {
        strokeColor = '#dc2626'; // Red border for missing node types
        lineWidth = 3;
      } else if (isError) {
        strokeColor = '#ef4444'; // Simple red for errors
        lineWidth = 2;
      } else if (hasModifications) {
        strokeColor = '#10b981'; // Simple green for nodes with temporary changes
        lineWidth = 6;
      } else if (isRepositionSelected) {
        strokeColor = '#3b82f6'; // Blue for repositioning selection
        lineWidth = 3;
      } else if (isConnectionSourceSelected) {
        strokeColor = '#3b82f6'; // Bright blue border for source node
        lineWidth = 4;
      } else if (isConnectionTargetSelected) {
        strokeColor = '#ef4444'; // Bright red border for target node
        lineWidth = 4;
      } else if (isConnectionCompatible) {
        strokeColor = '#16a34a'; // Green border for compatible nodes
        lineWidth = 3;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;

      // Draw special state border
      ctx.beginPath();
      ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, cornerRadius);
      ctx.stroke();
    }


    // Draw node title with simple text rendering (only if showText is enabled)
    if (showText) {
      // Simple text color - opacity is already applied via globalAlpha for bypassed nodes
      ctx.fillStyle = '#ffffff';
      
      // Linear font scaling from 0% to 80% viewport scale
      // 0% → 50px, 10% → 45px, 20% → 40px, 30% → 35px, 40% → 30px, 50% → 25px, 60% → 20px, 70% → 15px, 80% → 10px
      // Above 80% → stays at 10px
      
      // Use viewport scale if provided, otherwise fallback to transform matrix
      let currentScale = 1.0; // Default scale
      
      if (viewportScale !== undefined) {
        currentScale = viewportScale;
      } else {
        const transform = ctx.getTransform();
        currentScale = transform.a; // a is the horizontal scale factor
      }
      
      // Linear interpolation from 0% to 80%
      const maxScale = 0.8;   // 80%
      const minFontSize = 50; // Font size at 0% (50px)
      const maxFontSize = 10; // Font size at 80%+ (10px)
      
      let fontSize: number;
      if (currentScale >= maxScale) {
        // Above 80%, use minimum font size
        fontSize = maxFontSize;
      } else {
        // Linear interpolation between 0% and 80%
        const progress = currentScale / maxScale; // 0.0 to 1.0
        fontSize = minFontSize - (progress * (minFontSize - maxFontSize));
      }
      
      const clampedFontSize = Math.max(15, Math.min(60, fontSize)); // Safety bounds
      
      // Additional adjustment for collapsed nodes
      const finalFontSize = isCollapsed 
        ? Math.min(clampedFontSize * 0.8, bounds.height / 3) 
        : clampedFontSize;
        
      ctx.font = `${finalFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Use actual title if available, otherwise type
      const displayText = node.title || node.type || `Node ${node.id}`;
      
      const textX = bounds.x + bounds.width / 2;
      const textY = bounds.y + bounds.height / 2; // Center text
      
      const maxTextWidth = bounds.width - 16;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate text if too long
      let truncatedText = displayText;
      const textMetrics = ctx.measureText(displayText);
      if (textMetrics.width > maxTextWidth) {
        // Truncate with ellipsis
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        const availableWidth = maxTextWidth - ellipsisWidth;
        
        let truncated = displayText;
        while (ctx.measureText(truncated).width > availableWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        truncatedText = truncated + ellipsis;
      }
      
      // Draw simple text without stroke
      ctx.fillText(truncatedText, textX, textY);
    }

    // Draw input and output slots
    if (showText) { // Only draw slots when text is shown (detail view)
      const slotRadius = 4;
      const slotHeight = 20;
      const topMargin = bounds.height * 0.05; // 5% from top
      
      // Get current font size for slot labels
      const slotFontSize = 10; // Fixed small size for slot labels
      
      // Check if collapsed - collapsed nodes show only one slot
      if (isCollapsed) {
        // For collapsed nodes, show single slot on each side if there are connections
        const hasInputConnections = node.inputs?.some((input: any) => input.link);
        const hasOutputConnections = node.outputs?.some((output: any) => output.links && output.links.length > 0);
        
        // Draw single input slot if there are connections
        if (hasInputConnections) {
          const slotY = bounds.y + bounds.height / 2;
          const slotX = bounds.x;
          
          ctx.fillStyle = '#10b981'; // Always green for collapsed connected slots
          ctx.beginPath();
          ctx.arc(slotX, slotY, slotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw single output slot if there are connections
        if (hasOutputConnections) {
          const slotY = bounds.y + bounds.height / 2;
          const slotX = bounds.x + bounds.width;
          
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(slotX, slotY, slotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // For expanded nodes, show only connected slots
        // Draw connected input slots
        if (node.inputs && node.inputs.length > 0) {
          let connectedIndex = 0; // Track position for connected slots only
          node.inputs.forEach((input: any, index: number) => {
            // Only draw if connected
            if (!input.link) return;
            
            const slotY = bounds.y + topMargin + (connectedIndex * slotHeight) + (slotHeight / 2);
            const slotX = bounds.x;
            connectedIndex++; // Increment only for connected slots
            
            // Draw slot circle (always green since it's connected)
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(slotX, slotY, slotRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw slot label (only if enough space)
            if (bounds.width > 100) {
              ctx.fillStyle = '#ffffff';
              ctx.font = `${slotFontSize}px system-ui, -apple-system, sans-serif`;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              const labelText = input.name || input.type || '';
              const maxLabelWidth = bounds.width * 0.3;
              
              // Truncate if too long
              let truncatedLabel = labelText;
              if (ctx.measureText(labelText).width > maxLabelWidth) {
                while (ctx.measureText(truncatedLabel + '...').width > maxLabelWidth && truncatedLabel.length > 0) {
                  truncatedLabel = truncatedLabel.slice(0, -1);
                }
                truncatedLabel += '...';
              }
              
              ctx.fillText(truncatedLabel, slotX + slotRadius + 4, slotY);
            }
          });
        }
        
        // Draw connected output slots
        if (node.outputs && node.outputs.length > 0) {
          let connectedIndex = 0; // Track position for connected slots only
          node.outputs.forEach((output: any, index: number) => {
            // Only draw if connected
            if (!output.links || output.links.length === 0) return;
            
            const slotY = bounds.y + topMargin + (connectedIndex * slotHeight) + (slotHeight / 2);
            const slotX = bounds.x + bounds.width;
            connectedIndex++; // Increment only for connected slots
            
            // Draw slot circle (always green since it's connected)
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(slotX, slotY, slotRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw slot label (only if enough space)
            if (bounds.width > 100) {
              ctx.fillStyle = '#ffffff';
              ctx.font = `${slotFontSize}px system-ui, -apple-system, sans-serif`;
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              const labelText = output.name || output.type || '';
              const maxLabelWidth = bounds.width * 0.3;
              
              // Truncate if too long
              let truncatedLabel = labelText;
              if (ctx.measureText(labelText).width > maxLabelWidth) {
                while (ctx.measureText(truncatedLabel + '...').width > maxLabelWidth && truncatedLabel.length > 0) {
                  truncatedLabel = truncatedLabel.slice(0, -1);
                }
                truncatedLabel += '...';
              }
              
              ctx.fillText(truncatedLabel, slotX - slotRadius - 4, slotY);
            }
          });
        }
      }
    }

    // Note: Progress is now shown as gradient background instead of separate progress bar
    
    // Draw execution state indicator
    if (isExecuting || isError) {
      const indicatorSize = 12;
      const indicatorX = bounds.x + bounds.width - indicatorSize - 4;
      const indicatorY = bounds.y + 4;
      
      ctx.fillStyle = isExecuting ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(indicatorX + indicatorSize/2, indicatorY + indicatorSize/2, indicatorSize/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Add icon inside indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = `${indicatorSize - 4}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        isExecuting ? '▶' : '✕',
        indicatorX + indicatorSize/2,
        indicatorY + indicatorSize/2
      );
    }
    
    // Restore context state (especially important for bypassed nodes with opacity)
    ctx.restore();

    // Draw resize grippers if this node is selected in repositioning mode (but not if collapsed)
    if (isRepositionSelected && !repositionMode?.resizeMode?.isActive && !isCollapsed) {
      drawResizeGrippers(
        ctx,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        viewportScale || 1
      );
    }
  }

  // Long press visual feedback is now handled by DOM overlay in WorkflowCanvas
  // This provides better reliability and positioning than canvas rendering
}

/**
 * Draw grid pattern on canvas background
 */
export function drawGridPattern(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  viewport: ViewportTransform
): void {
  const gridSize = 20; // Base grid size in pixels
  const dotSize = 1.5; // Size of grid dots
  
  // Calculate grid offset based on viewport position
  const offsetX = viewport.x % (gridSize * viewport.scale);
  const offsetY = viewport.y % (gridSize * viewport.scale);
  
  // Grid color (subtle dots)
  ctx.fillStyle = 'rgba(100, 116, 139, 0.3)'; // Slightly visible dots
  
  // Draw grid dots
  const scaledGridSize = gridSize * viewport.scale;
  
  // Only draw if grid is not too small or too large
  if (scaledGridSize > 5 && scaledGridSize < 100) {
    for (let x = offsetX; x < canvasWidth + scaledGridSize; x += scaledGridSize) {
      for (let y = offsetY; y < canvasHeight + scaledGridSize; y += scaledGridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Draw enhanced grid for repositioning mode
 */
export function drawRepositioningGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  viewport: ViewportTransform
): void {
  const gridSize = 20; // Base grid size in pixels
  
  // Calculate grid offset based on viewport position
  const offsetX = viewport.x % (gridSize * viewport.scale);
  const offsetY = viewport.y % (gridSize * viewport.scale);
  
  // Draw grid lines (more visible than dots)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'; // Blue grid lines
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]); // Dashed lines
  
  const scaledGridSize = gridSize * viewport.scale;
  
  // Only draw if grid is large enough to be visible
  if (scaledGridSize > 8) {
    ctx.beginPath();
    
    // Draw vertical lines
    for (let x = offsetX; x < canvasWidth + scaledGridSize; x += scaledGridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }
    
    // Draw horizontal lines
    for (let y = offsetY; y < canvasHeight + scaledGridSize; y += scaledGridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    }
    
    ctx.stroke();
  }
  
  // Reset line dash
  ctx.setLineDash([]);
}

/**
 * Draw resize grippers for selected node/group in repositioning mode
 */
export function drawResizeGrippers(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  viewportScale: number = 1
): void {
  const gripperSize = 16; // Base gripper size in screen pixels
  const actualGripperSize = gripperSize / viewportScale; // Adjust for viewport scale
  const halfGripper = actualGripperSize / 2;

  // Gripper style
  ctx.fillStyle = '#3b82f6'; // Blue color matching selection border
  ctx.strokeStyle = '#ffffff'; // White border for visibility
  ctx.lineWidth = 1 / viewportScale; // Adjust line width for viewport scale

  // Calculate gripper positions
  const grippers = [
    // Corners (allow both width and height resize)
    { x: x - halfGripper, y: y - halfGripper, position: 'top-left' },
    { x: x + width - halfGripper, y: y - halfGripper, position: 'top-right' },
    { x: x - halfGripper, y: y + height - halfGripper, position: 'bottom-left' },
    { x: x + width - halfGripper, y: y + height - halfGripper, position: 'bottom-right' },

    // Edges (allow single dimension resize)
    { x: x + width / 2 - halfGripper, y: y - halfGripper, position: 'top' },
    { x: x + width / 2 - halfGripper, y: y + height - halfGripper, position: 'bottom' },
    { x: x - halfGripper, y: y + height / 2 - halfGripper, position: 'left' },
    { x: x + width - halfGripper, y: y + height / 2 - halfGripper, position: 'right' },
  ];

  // Draw each gripper
  for (const gripper of grippers) {
    ctx.fillRect(gripper.x, gripper.y, actualGripperSize, actualGripperSize);
    ctx.strokeRect(gripper.x, gripper.y, actualGripperSize, actualGripperSize);
  }
}

/**
 * Check if a point intersects with any resize gripper
 */
export function getGripperAtPoint(
  x: number,
  y: number,
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  viewportScale: number = 1
): { position: string; type: 'corner' | 'edge' } | null {
  const gripperSize = 16; // Base gripper size in screen pixels
  const actualGripperSize = gripperSize / viewportScale;
  const halfGripper = actualGripperSize / 2;
  const hitTestSize = Math.max(actualGripperSize, 32 / viewportScale); // Minimum 32px hit area for better touch
  const halfHitTest = hitTestSize / 2;

  // Define grippers with hit test areas
  const grippers = [
    // Corners
    {
      x: nodeX - halfHitTest,
      y: nodeY - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'top-left',
      type: 'corner' as const
    },
    {
      x: nodeX + nodeWidth - halfHitTest,
      y: nodeY - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'top-right',
      type: 'corner' as const
    },
    {
      x: nodeX - halfHitTest,
      y: nodeY + nodeHeight - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'bottom-left',
      type: 'corner' as const
    },
    {
      x: nodeX + nodeWidth - halfHitTest,
      y: nodeY + nodeHeight - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'bottom-right',
      type: 'corner' as const
    },

    // Edges
    {
      x: nodeX + nodeWidth / 2 - halfHitTest,
      y: nodeY - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'top',
      type: 'edge' as const
    },
    {
      x: nodeX + nodeWidth / 2 - halfHitTest,
      y: nodeY + nodeHeight - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'bottom',
      type: 'edge' as const
    },
    {
      x: nodeX - halfHitTest,
      y: nodeY + nodeHeight / 2 - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'left',
      type: 'edge' as const
    },
    {
      x: nodeX + nodeWidth - halfHitTest,
      y: nodeY + nodeHeight / 2 - halfHitTest,
      width: hitTestSize,
      height: hitTestSize,
      position: 'right',
      type: 'edge' as const
    },
  ];

  // Check each gripper
  for (const gripper of grippers) {
    if (x >= gripper.x && x <= gripper.x + gripper.width &&
        y >= gripper.y && y <= gripper.y + gripper.height) {
      return { position: gripper.position, type: gripper.type };
    }
  }

  return null;
}

/**
 * Generate workflow thumbnail as base64 data URL
 */
export function generateWorkflowThumbnail(
  workflow: { nodes: IComfyGraphNode[]; links?: IComfyGraphLink[]; groups?: IGroup[] },
  canvasWidth: number = 400,
  canvasHeight: number = 300,
  config: CanvasConfig = DEFAULT_CANVAS_CONFIG
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Clear canvas with background color
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!workflow.nodes || workflow.nodes.length === 0) {
    // Draw empty state
    ctx.fillStyle = config.textColor;
    ctx.font = `${config.fontSize + 2}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Empty Workflow', canvasWidth / 2, canvasHeight / 2);
    return canvas.toDataURL('image/png');
  }

  // Calculate bounds for all elements
  const { nodeBounds, groupBounds } = calculateAllBounds(
    workflow.nodes, 
    workflow.groups,
    config,
    canvasWidth,
    canvasHeight
  );
  
  // Draw groups first (background layer) - no text for thumbnails
  if (groupBounds.length > 0) {
    renderGroups(ctx, groupBounds, config, false);
  }

  // Skip connections for thumbnails - cleaner appearance
  // Connection lines are omitted in thumbnails for better visual clarity

  // Draw nodes (foreground layer) - no text for thumbnails
  renderNodes(ctx, workflow.nodes, nodeBounds, config, { showText: false });

  return canvas.toDataURL('image/png');
}