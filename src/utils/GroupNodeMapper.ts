import type { IComfyGraphNode } from '@/shared/types/app/base';

export interface Group {
  id: number;
  title: string;
  bounding: [number, number, number, number]; // [x, y, width, height]
  color?: string;
  nodeIds: number[];
}

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two bounding boxes intersect (AABB collision detection)
 * @param rect1 First bounding box [x, y, width, height]
 * @param rect2 Second bounding box [x, y, width, height]
 * @returns true if rectangles intersect
 */
export function boundingBoxesIntersect(
  rect1: [number, number, number, number],
  rect2: [number, number, number, number]
): boolean {
  const [x1, y1, w1, h1] = rect1;
  const [x2, y2, w2, h2] = rect2;
  
  // Check if rectangles do NOT intersect (easier logic)
  const noIntersection = (
    x1 >= x2 + w2 || // rect1 is to the right of rect2
    x2 >= x1 + w1 || // rect2 is to the right of rect1
    y1 >= y2 + h2 || // rect1 is below rect2
    y2 >= y1 + h1    // rect2 is below rect1
  );
  
  return !noIntersection;
}

/**
 * Check if a node's position is within a group's bounding box
 * Uses only the node's position (pos) without considering node size,
 * matching ComfyUI's original behavior
 * @param node ComfyUI graph node
 * @param groupBounding Group's bounding box [x, y, width, height]
 * @returns true if node position is inside group bounds
 */
export function isNodeInGroup(
  node: IComfyGraphNode,
  groupBounding: [number, number, number, number]
): boolean {
  if (!node.pos) {
    return false;
  }
  
  const [nodeX, nodeY] = node.pos;
  const [groupX, groupY, groupWidth, groupHeight] = groupBounding;
  
  // Simple point-in-rectangle check (node position only)
  return (
    nodeX >= groupX &&
    nodeX <= groupX + groupWidth &&
    nodeY >= groupY &&
    nodeY <= groupY + groupHeight
  );
}

/**
 * Map groups from ComfyUI graph data and identify which nodes belong to each group
 * @param graphGroups Raw groups data from ComfyUI graph
 * @param nodes Array of ComfyUI graph nodes
 * @returns Array of groups with their associated node IDs
 */
export function mapGroupsWithNodes(
  graphGroups: any[],
  nodes: IComfyGraphNode[]
): Group[] {
  if (!graphGroups || !Array.isArray(graphGroups)) {
    return [];
  }
  
  return graphGroups.map((rawGroup) => {
    const group: Group = {
      id: rawGroup.id || 0,
      title: rawGroup.title || `Group ${rawGroup.id}`,
      bounding: rawGroup.bounding || [0, 0, 0, 0],
      color: rawGroup.color,
      nodeIds: []
    };
    
    // Find all nodes that intersect with this group
    group.nodeIds = nodes
      .filter(node => isNodeInGroup(node, group.bounding))
      .map(node => typeof node.id === 'string' ? parseInt(node.id) : node.id)
      .filter(id => !isNaN(id));
    
    return group;
  })
  .filter(group => group.nodeIds.length > 0); // Only return groups that have nodes
}

/**
 * Get all nodes that belong to a specific group
 * @param groupId Group ID to find nodes for
 * @param groups Array of groups with node mappings
 * @param allNodes Array of all available nodes
 * @returns Array of nodes that belong to the specified group
 */
export function getNodesInGroup(
  groupId: number,
  groups: Group[],
  allNodes: IComfyGraphNode[]
): IComfyGraphNode[] {
  const group = groups.find(g => g.id === groupId);
  if (!group) return [];
  
  return allNodes.filter(node => {
    const nodeId = typeof node.id === 'string' ? parseInt(node.id) : node.id;
    return group.nodeIds.includes(nodeId);
  });
}