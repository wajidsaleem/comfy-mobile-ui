/**
 * Execution state tracking for LiteGraph workflows
 * Monitors node execution progress and status
 */

import type { IComfyGraphNode } from '@/shared/types/app/base'

// ============================================================================
// Types
// ============================================================================

export const ExecutionStatus = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const

export type ExecutionStatus = typeof ExecutionStatus[keyof typeof ExecutionStatus]

export const NodeExecutionStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const

export type NodeExecutionStatus = typeof NodeExecutionStatus[keyof typeof NodeExecutionStatus]

export interface ExecutionProgress {
  status: ExecutionStatus
  totalNodes: number
  completedNodes: number
  currentNode: number | null
  currentNodeType: string | null
  progress: number // 0-100
  startTime: number | null
  endTime: number | null
  elapsedTime: number
  estimatedTimeRemaining: number | null
  errors: ExecutionError[]
}

export interface NodeExecutionInfo {
  nodeId: number
  nodeType: string
  nodeTitle: string
  status: NodeExecutionStatus
  startTime: number | null
  endTime: number | null
  duration: number | null
  error: string | null
  output: any | null
  retryCount: number
}

export interface ExecutionError {
  nodeId: number
  nodeType: string
  message: string
  timestamp: number
  details?: any
}

export interface ExecutionMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastExecutionTime: number
  nodeMetrics: Map<string, NodeMetrics>
}

export interface NodeMetrics {
  nodeType: string
  executionCount: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  errorCount: number
}

// ============================================================================
// ExecutionTracker Module State
// ============================================================================

// Module-level state
let executionStatus: ExecutionStatus = ExecutionStatus.IDLE
let nodeStatus: Map<number, NodeExecutionInfo> = new Map()
let executionOrder: IComfyGraphNode[] = []
let currentIndex: number = -1
let startTime: number | null = null
let endTime: number | null = null
let errors: ExecutionError[] = []
let metrics: ExecutionMetrics = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  averageExecutionTime: 0,
  lastExecutionTime: 0,
  nodeMetrics: new Map()
}

// Performance tracking
let nodeTimings: Map<number, number> = new Map()
  
/**
 * Start tracking a new execution
 */
export function startExecution(nodes: IComfyGraphNode[]): void {
  resetExecution()
  executionStatus = ExecutionStatus.PREPARING
  executionOrder = nodes
  startTime = Date.now()
  metrics.totalExecutions++
    
    // Initialize node status
    for (const node of nodes) {
      nodeStatus.set(node.id as number, {
        nodeId: node.id as number,
        nodeType: node.type,
        nodeTitle: node.title || node.type,
        status: NodeExecutionStatus.PENDING,
        startTime: null,
        endTime: null,
        duration: null,
        error: null,
        output: null,
        retryCount: 0
      })
    }
    
    executionStatus = ExecutionStatus.RUNNING
  }
  
/**
 * Mark a node as started
 */
export function startNode(nodeId: number): void {
  const info = nodeStatus.get(nodeId)
  if (!info) return
  
  info.status = NodeExecutionStatus.EXECUTING
  info.startTime = Date.now()
  nodeTimings.set(nodeId, info.startTime)
  
  // Update current index
  const index = executionOrder.findIndex(n => n.id === nodeId)
  if (index >= 0) {
    currentIndex = index
  }
}
  
/**
 * Mark a node as completed
 */
export function completeNode(nodeId: number, output?: any): void {
  const info = nodeStatus.get(nodeId)
  if (!info) return
  
  info.status = NodeExecutionStatus.COMPLETED
  info.endTime = Date.now()
  info.duration = info.startTime ? info.endTime - info.startTime : null
  info.output = output
  
  // Update metrics
  updateNodeMetrics(info)
}
  
/**
 * Mark a node as errored
 */
export function errorNode(nodeId: number, error: string, details?: any): void {
  const info = nodeStatus.get(nodeId)
  if (!info) return
  
  info.status = NodeExecutionStatus.ERROR
  info.endTime = Date.now()
  info.duration = info.startTime ? info.endTime - info.startTime : null
  info.error = error
  
  // Add to errors list
  errors.push({
    nodeId,
    nodeType: info.nodeType,
    message: error,
    timestamp: Date.now(),
    details
  })
  
  // Update metrics
  const nodeMetrics = getOrCreateNodeMetrics(info.nodeType)
  nodeMetrics.errorCount++
}
  
/**
 * Skip a node (e.g., muted or bypassed)
 */
export function skipNode(nodeId: number): void {
  const info = nodeStatus.get(nodeId)
  if (!info) return
  
  info.status = NodeExecutionStatus.SKIPPED
  info.startTime = Date.now()
  info.endTime = info.startTime
  info.duration = 0
}
  
/**
 * Complete the entire execution
 */
export function completeExecution(): void {
  executionStatus = ExecutionStatus.COMPLETED
  endTime = Date.now()
  
  if (startTime) {
    metrics.lastExecutionTime = endTime - startTime
    updateAverageExecutionTime()
  }
  
  // Check if execution was successful
  const hasErrors = errors.length > 0
  if (hasErrors) {
    metrics.failedExecutions++
  } else {
    metrics.successfulExecutions++
  }
}
  
/**
 * Cancel the execution
 */
export function cancelExecution(): void {
  executionStatus = ExecutionStatus.CANCELLED
  endTime = Date.now()
  
  // Mark pending nodes as cancelled
  for (const [, info] of nodeStatus) {
    if (info.status === NodeExecutionStatus.PENDING || 
        info.status === NodeExecutionStatus.EXECUTING) {
      info.status = NodeExecutionStatus.CANCELLED
      info.endTime = Date.now()
    }
  }
}
  
/**
 * Pause the execution
 */
export function pauseExecution(): void {
  if (executionStatus === ExecutionStatus.RUNNING) {
    executionStatus = ExecutionStatus.PAUSED
  }
}
  
/**
 * Resume the execution
 */
export function resumeExecution(): void {
  if (executionStatus === ExecutionStatus.PAUSED) {
    executionStatus = ExecutionStatus.RUNNING
  }
}
  
/**
 * Get current progress
 */
export function getProgress(): ExecutionProgress {
  const totalNodes = executionOrder.length
  const completedNodes = Array.from(nodeStatus.values()).filter(
    info => info.status === NodeExecutionStatus.COMPLETED ||
            info.status === NodeExecutionStatus.SKIPPED
  ).length
  
  const currentNode = currentIndex >= 0 
    ? executionOrder[currentIndex] 
    : null
  
  const elapsedTime = startTime 
    ? (endTime || Date.now()) - startTime 
    : 0
  
  // Estimate remaining time based on average node execution time
  let estimatedTimeRemaining: number | null = null
  if (completedNodes > 0 && totalNodes > completedNodes) {
    const averageNodeTime = elapsedTime / completedNodes
    estimatedTimeRemaining = averageNodeTime * (totalNodes - completedNodes)
  }
  
  return {
    status: executionStatus,
    totalNodes,
    completedNodes,
    currentNode: currentNode?.id as number || null,
    currentNodeType: currentNode?.type || null,
    progress: totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0,
    startTime,
    endTime,
    elapsedTime,
    estimatedTimeRemaining,
    errors: [...errors]
  }
}
  
/**
 * Get node execution info
 */
export function getNodeInfo(nodeId: number): NodeExecutionInfo | undefined {
  return nodeStatus.get(nodeId)
}
  
/**
 * Get all node execution info
 */
export function getAllNodeInfo(): NodeExecutionInfo[] {
  return Array.from(nodeStatus.values())
}
  
/**
 * Get execution metrics
 */
export function getMetrics(): ExecutionMetrics {
  return {
    ...metrics,
    nodeMetrics: new Map(metrics.nodeMetrics)
  }
}
  
/**
 * Reset tracker state
 */
export function resetExecution(): void {
  executionStatus = ExecutionStatus.IDLE
  nodeStatus.clear()
  executionOrder = []
  currentIndex = -1
  startTime = null
  endTime = null
  errors = []
  nodeTimings.clear()
}
  
/**
 * Get execution status
 */
export function getStatus(): ExecutionStatus {
  return executionStatus
}
  
/**
 * Check if execution is running
 */
export function isRunning(): boolean {
  return executionStatus === ExecutionStatus.RUNNING
}
  
/**
 * Check if execution is complete
 */
export function isComplete(): boolean {
  return executionStatus === ExecutionStatus.COMPLETED ||
         executionStatus === ExecutionStatus.ERROR ||
         executionStatus === ExecutionStatus.CANCELLED
}
  
/**
 * Get errors
 */
export function getErrors(): ExecutionError[] {
  return [...errors]
}
  
// ============================================================================
// Private Functions
// ============================================================================

function updateNodeMetrics(info: NodeExecutionInfo): void {
  if (info.duration === null) return
  
  const nodeMetrics = getOrCreateNodeMetrics(info.nodeType)
  nodeMetrics.executionCount++
  nodeMetrics.totalTime += info.duration
  nodeMetrics.averageTime = nodeMetrics.totalTime / nodeMetrics.executionCount
  nodeMetrics.minTime = Math.min(nodeMetrics.minTime, info.duration)
  nodeMetrics.maxTime = Math.max(nodeMetrics.maxTime, info.duration)
}
  
function getOrCreateNodeMetrics(nodeType: string): NodeMetrics {
  let nodeMetrics = metrics.nodeMetrics.get(nodeType)
  if (!nodeMetrics) {
    nodeMetrics = {
      nodeType,
      executionCount: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0
    }
    metrics.nodeMetrics.set(nodeType, nodeMetrics)
  }
  return nodeMetrics
}
  
function updateAverageExecutionTime(): void {
  const total = metrics.totalExecutions
  const current = metrics.lastExecutionTime
  const previous = metrics.averageExecutionTime
  
  metrics.averageExecutionTime = 
    (previous * (total - 1) + current) / total
}