/**
 * ExecutableDTO - Execution wrapper classes for ComfyUI nodes
 * Separated from ComfyGraphProcessor for better organization
 */

import type { IComfyWidget } from '@/shared/types/app/base'
import type { ComfyGraphNode } from '@/core/domain/ComfyGraphNode'
import { NodeMode } from '@/shared/types/app/enums'
import type { IComfyGraphLink } from '@/shared/types/app/IComfyGraphLink'
import { API_VIRTUAL_NODES } from '@/shared/constants/virtualNodes'
// Exported type definitions
export interface ResolvedInput {
  linkId: number | null;
  name: string;
  type: string;
  node?: ExecutableComfyNode;
  origin_id?: number | string;
  origin_slot?: number;
}

export interface ExecutableComfyNode {
  id: number | string;
  type: string;
  inputs?: ResolvedInput[];
  outputs?: any[];
  resolveOutput?: (...args: any[]) => any;
  comfyClass?: string;
}

// Error Classes
class NullGraphError extends Error {
  constructor(message = "Node graph is null or undefined.") {
    super(message)
    this.name = "NullGraphError"
  }
}


// ============================================================================
// Virtual Node Implementations
// ============================================================================

// Virtual node checker functions
function isVirtualNode(node: ComfyGraphNode): boolean {
  return (node as any).isVirtualNode === true
}

function isVirtualNodeByType(nodeType: string): boolean {
  return API_VIRTUAL_NODES.has(nodeType)
}

function filterVirtualNodes(nodes: ComfyGraphNode[]): ComfyGraphNode[] {
  return nodes.filter(node => !isVirtualNode(node))
}

export interface DependencyNode {
  nodeId: number;
  nodeType: string;
  title?: string;
  inputs: Array<{
    name: string;
    sourceNodeId?: number;
    sourceSlot?: number;
    linkId?: number;
  }>;
  outputs: Array<{
    name: string;
    connectedTo: Array<{
      targetNodeId: number;
      targetSlot: number;
      linkId: number;
    }>;
  }>;
}

export interface DependencyPath {
  targetNodeId: number;
  requiredNodes: Set<number>;
  requiredLinks: Set<number>;
  dependencyTree: Map<number, DependencyNode>;
  executionOrder: number[];
}

export interface FilteredWorkflow {
  originalWorkflow: any;
  filteredWorkflow: any;
  requiredNodeIds: Set<number>;
  requiredLinkIds: Set<number>;
  removedNodeCount: number;
  removedLinkCount: number;
}




// ============================================================================
// Error Classes
// ============================================================================

export class SlotIndexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlotIndexError'
  }
}

export class InvalidLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidLinkError'
  }
}

export class RecursionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecursionError'
  }
}

// ============================================================================
// Interfaces
// ============================================================================

// Note: ResolvedInput and ExecutableComfyNode are imported from IExecutable types

// ============================================================================
// ExecutableNodeDTO Implementation
// ============================================================================

/**
 * ExecutableNodeDTO - Wraps ComfyGraphNode for execution processing
 * Based on ComfyUI's ExecutableNodeDTO implementation
 */
export class ExecutableNodeDTO implements ExecutableComfyNode {
  /** The wrapped ComfyGraphNode */
  readonly node: ComfyGraphNode
  /** Subgraph path (root to current node subgraph node IDs) */
  readonly subgraphNodePath: readonly number[]
  /** Map of all execution nodes */
  readonly nodesByExecutionId: Map<string, ExecutableComfyNode>
  /** Containing subgraph node if any */
  readonly subgraphNode?: any
  
  /** Graph reference removed to prevent circular references */
  // readonly graph: IComfyGraph
  /** Input slot information */
  readonly inputs: {
    linkId: number | null
    name: string
    type: string
  }[]
  
  /** Unique execution ID */
  private readonly _id: string
  
  /** applyToGraph method for virtual nodes */
  applyToGraph?: (...args: any[]) => any
  
  constructor(
    node: ComfyGraphNode,
    subgraphNodePath: readonly number[],
    nodesByExecutionId: Map<string, ExecutableComfyNode>,
    subgraphNode?: any
  ) {
    // Graph property check removed to prevent circular references
    
    this.node = node
    this.subgraphNodePath = subgraphNodePath
    this.nodesByExecutionId = nodesByExecutionId
    this.subgraphNode = subgraphNode
    
    // Generate unique execution ID: "subgraph_path:node_id"
    this._id = [...this.subgraphNodePath, this.node.id].join(":")
    
    // Graph assignment removed to prevent circular references
    
    // Copy input slot information
    this.inputs = (this.node.inputs || []).map((input: any) => ({
      linkId: input.link,
      name: input.name,
      type: input.type
    }))
    
    // Wrap virtual node's applyToGraph method
    if ((this.node as any).applyToGraph) {
      this.applyToGraph = (...args) => (this.node as any).applyToGraph?.(...args)
    }
  }
  
  // Getter properties
  get id(): string {
    return this._id
  }
  
  get type(): string {
    return this.node.type
  }
  
  get title(): string {
    return this.node.title || this.node.type
  }
  
  get mode(): NodeMode {
    return (this.node.mode as NodeMode) || NodeMode.ALWAYS
  }
  
  get comfyClass(): string | undefined {
    return (this.node as any).comfyClass || this.node.type
  }
  
  get isVirtualNode(): boolean | undefined {
    return (this.node as any).isVirtualNode
  }
  
  get widgets(): IComfyWidget[] | undefined {
    return this.node.getWidgets() as IComfyWidget[]
  }
  
  // Return inner nodes (for subgraphs - simplified to return self)
  getInnerNodes(): ExecutableComfyNode[] {
    return [this]
  }
  
  /**
   * Resolve input slot connections to find actual source node and slot
   */
  resolveInput(slot: number, visited = new Set<string>()): ResolvedInput | undefined {
    // Prevent circular references
    const uniqueId = `${this.subgraphNode?.subgraph?.id || 'root'}:${this.node.id}[I]${slot}`
    if (visited.has(uniqueId)) {
      const nodeInfo = `${this.node.id}${this.node.title ? ` (${this.node.title})` : ""}`
      const pathInfo = this.subgraphNodePath.length > 0 ? ` at path ${this.subgraphNodePath.join(":")}` : ""
      throw new RecursionError(
        `Circular reference detected while resolving input ${slot} of node ${nodeInfo}${pathInfo}. UniqueID: [${uniqueId}]`
      )
    }
    visited.add(uniqueId)
    
    // Check input slot exists
    const input = this.inputs[slot]
    if (!input) {
      throw new SlotIndexError(`No input found for flattened id [${this.id}] slot [${slot}]`)
    }
    
    // Unconnected input
    if (input.linkId === null) return undefined
    
    // Get link information
    const link = (this as any).graph._links?.[input.linkId]
    if (!link) {
      throw new InvalidLinkError(`No link found in parent graph for id [${this.id}] slot [${slot}] ${input.name}`)
    }
    
    // Find connected output node
    const outputNode = (this as any).graph.getNodeById((link as IComfyGraphLink).origin_id)
    if (!outputNode) {
      throw new InvalidLinkError(`No input node found for id [${this.id}] slot [${slot}] ${input.name}`)
    }
    
    // Find output node's DTO
    const outputNodeExecutionId = [...this.subgraphNodePath, outputNode.id].join(":")
    const outputNodeDto = this.nodesByExecutionId.get(outputNodeExecutionId)
    if (!outputNodeDto) {
      throw new Error(`No output node DTO found for id [${outputNodeExecutionId}]`)
    }
    
    // Resolve from output node
    return outputNodeDto.resolveOutput?.((link as IComfyGraphLink).origin_slot, input.type, visited)
  }
  
  /**
   * Resolve output slot to find valid connection point (handles virtual nodes, bypass mode)
   */
  resolveOutput(slot: number, type: string, visited: Set<string>): ResolvedInput | undefined {
    // Prevent circular references
    const uniqueId = `${this.subgraphNode?.subgraph?.id || 'root'}:${this.node.id}[O]${slot}`
    if (visited.has(uniqueId)) {
      const nodeInfo = `${this.node.id}${this.node.title ? ` (${this.node.title})` : ""}`
      const pathInfo = this.subgraphNodePath.length > 0 ? ` at path ${this.subgraphNodePath.join(":")}` : ""
      throw new RecursionError(
        `Circular reference detected while resolving output ${slot} of node ${nodeInfo}${pathInfo}. UniqueID: [${uniqueId}]`
      )
    }
    visited.add(uniqueId)
    
    // BYPASS mode handling - pass through to matching input type
    if (this.mode === NodeMode.BYPASS) {
      const inputIndexes = Object.keys(this.inputs).map(Number)
      const indexes = [slot, ...inputIndexes]
      const matchingIndex = indexes.find(i => this.inputs[i]?.type === type)
      
      if (matchingIndex === undefined) {
        console.debug(`[ExecutableNodeDTO.resolveOutput] No input types match type [${type}] for id [${this.id}] slot [${slot}]`, this)
        return undefined
      }
      
      return this.resolveInput(matchingIndex, visited)
    }
    
    // Virtual node handling
    if ((this.node as any).isVirtualNode) {
      // Pass through to input if available
      if (this.inputs[slot]) {
        return this.resolveInput(slot, visited)
      }
      
      // Handle virtual links (Primitive nodes, etc.)
      const virtualLink = this.node.getInputLink?.(slot)
      if (virtualLink) {
        const outputNode = (this as any).graph.getNodeById(virtualLink)
        if (!outputNode) {
          throw new InvalidLinkError(`Virtual node failed to resolve parent [${this.id}] slot [${slot}]`)
        }
        
        const outputNodeExecutionId = [...this.subgraphNodePath, outputNode.id].join(":")
        const outputNodeDto = this.nodesByExecutionId.get(outputNodeExecutionId)
        if (!outputNodeDto) {
          throw new Error(`No output node DTO found for id [${outputNode.id}]`)
        }
        
        return outputNodeDto.resolveOutput?.(virtualLink, type, visited)
      }
      
      // No more resolution possible for virtual nodes
      return undefined
    }
    
    // Regular node - return direct reference
    return {
      linkId: null,
      name: '',
      type: type,
      node: this,
      origin_id: this.id,
      origin_slot: slot
    }
  }
}

// ============================================================================
// SetNode/GetNode Special Processing
// ============================================================================

// Variable Store Interface
interface VariableStore {
  [variableName: string]: {
    sourceNodeId: string
    dataType: string
    value: any
  }
}

/**
 * SetNode/GetNode Processor - Handles variable-based logical connections
 */
export class SetGetNodeProcessor {
  private variables: VariableStore = {}
  
  // Process SetNode - register variable
  processSetNode(nodeId: string, node: ExecutableComfyNode): void {
    if (node.comfyClass !== 'SetNode') return
    
    const variableName = this.getSetNodeVariableName(node)
    const dataType = this.getSetNodeDataType(node)
    const value = this.getSetNodeValue(node)
    
    this.variables[variableName] = {
      sourceNodeId: nodeId,
      dataType,
      value
    }
  }
  
  // Process GetNode - resolve variable reference
  processGetNode(nodeId: string, node: ExecutableComfyNode): any {
    if (node.comfyClass !== 'GetNode') return null
    
    const variableName = this.getGetNodeVariableName(node)
    const variable = this.variables[variableName]
    
    if (!variable) {
      throw new Error(`Variable '${variableName}' not found for GetNode ${nodeId}`)
    }
    
    return variable.value
  }
  
  private getSetNodeVariableName(node: ExecutableComfyNode): string {
    const valueWidget = (node as any).widgets?.find((w: any) => w.name === 'value')
    return valueWidget?.value as string
  }
  
  private getSetNodeDataType(node: ExecutableComfyNode): string {
    const dataWidget = (node as any).widgets?.find((w: any) => w.name !== 'value')
    return dataWidget?.name || 'UNKNOWN'
  }
  
  private getSetNodeValue(node: ExecutableComfyNode): any {
    const dataWidget = (node as any).widgets?.find((w: any) => w.name !== 'value')
    return dataWidget?.value
  }
  
  private getGetNodeVariableName(node: ExecutableComfyNode): string {
    const paramWidget = (node as any).widgets?.find((w: any) => w.name === 'param_0')
    return paramWidget?.value as string
  }
  
  /**
   * Core method: Convert SetNode/GetNode connections to direct connections and remove nodes
   */
  resolveConnections(apiWorkflow: any): any {
    // Step 1: Replace GetNode references with SetNode references
    for (const [nodeId, nodeData] of Object.entries(apiWorkflow)) {
      for (const [inputName, inputValue] of Object.entries((nodeData as any).inputs)) {
        if (Array.isArray(inputValue) && inputValue.length === 2) {
          const [sourceNodeId, sourceSlot] = inputValue
          
          // Check if source is GetNode
          const sourceNode = apiWorkflow[sourceNodeId]
          if ((sourceNode as any)?.class_type === 'GetNode') {
            // Find GetNode's variable name
            const variableName = (sourceNode as any).inputs.param_0 as string
            const variable = this.variables[variableName]
            
            if (variable) {
              // Replace GetNode reference with SetNode reference
              (nodeData as any).inputs[inputName] = [variable.sourceNodeId, 0]
            }
          }
        }
      }
    }
    
    // Step 2: Remove SetNode and GetNode from API completely
    for (const [nodeId, nodeData] of Object.entries(apiWorkflow)) {
      if ((nodeData as any).class_type === 'SetNode' || (nodeData as any).class_type === 'GetNode') {
        delete apiWorkflow[nodeId]
      }
    }
    
    return apiWorkflow
  }
}
