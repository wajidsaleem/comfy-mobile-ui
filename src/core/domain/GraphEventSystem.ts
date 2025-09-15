/**
 * Event system for LiteGraph workflows
 * Provides event-driven architecture for graph operations
 */

import type { IComfyGraphNode } from '@/shared/types/app/base'
import type { IComfyGraphLink } from '@/shared/types/app/base'
import type { IComfyWidget } from '@/shared/types/app/base'

// ============================================================================
// Event Types
// ============================================================================

export const GraphEventTypes = {
  // Graph events
  GRAPH_CONFIGURED: 'graph:configured',
  GRAPH_CLEARED: 'graph:cleared',
  GRAPH_SERIALIZED: 'graph:serialized',
  
  // Node events
  NODE_ADDED: 'node:added',
  NODE_REMOVED: 'node:removed',
  NODE_SELECTED: 'node:selected',
  NODE_DESELECTED: 'node:deselected',
  NODE_MOVED: 'node:moved',
  NODE_RESIZED: 'node:resized',
  NODE_PROPERTY_CHANGED: 'node:property_changed',
  NODE_MODE_CHANGED: 'node:mode_changed',
  NODE_TITLE_CHANGED: 'node:title_changed',
  NODE_PROPERTY_DEFINED: 'node:property_defined',
  
  // Connection events
  LINK_CREATED: 'link:created',
  LINK_REMOVED: 'link:removed',
  CONNECTION_FAILED: 'connection:failed',
  LINK_DATA_TRANSFERRED: 'link:data_transferred',
  LINK_DATA_CLEARED: 'link:data_cleared',
  
  // Widget events
  WIDGET_VALUE_CHANGED: 'widget:value_changed',
  WIDGET_ADDED: 'widget:added',
  WIDGET_REMOVED: 'widget:removed',
  
  // Execution events
  EXECUTION_STARTED: 'execution:started',
  EXECUTION_NODE_STARTED: 'execution:node_started',
  EXECUTION_NODE_COMPLETED: 'execution:node_completed',
  EXECUTION_NODE_ERROR: 'execution:node_error',
  EXECUTION_NODE_QUEUED: 'execution:node_queued',
  EXECUTION_COMPLETED: 'execution:completed',
  EXECUTION_CANCELLED: 'execution:cancelled',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_RESUMED: 'execution:resumed',
  
  // Validation events
  VALIDATION_STARTED: 'validation:started',
  VALIDATION_COMPLETED: 'validation:completed',
  VALIDATION_ERROR: 'validation:error',
  
  // UI events
  CANVAS_CLICKED: 'canvas:clicked',
  CANVAS_DOUBLE_CLICKED: 'canvas:double_clicked',
  CANVAS_ZOOM_CHANGED: 'canvas:zoom_changed',
  CANVAS_PAN_CHANGED: 'canvas:pan_changed',
  
  // File events
  WORKFLOW_LOADED: 'workflow:loaded',
  WORKFLOW_SAVED: 'workflow:saved',
  WORKFLOW_EXPORTED: 'workflow:exported',
  WORKFLOW_IMPORTED: 'workflow:imported',
  
  // Error events
  ERROR_OCCURRED: 'error:occurred',
  WARNING_OCCURRED: 'warning:occurred',
  
  // Mouse events
  NODE_MOUSE_DOWN: 'node:mouse_down',
  NODE_MOUSE_UP: 'node:mouse_up',
  NODE_MOUSE_MOVE: 'node:mouse_move',
  NODE_DOUBLE_CLICK: 'node:double_click',
  
  // Registry events
  NODE_TYPE_REGISTERED: 'node:type_registered',
  NODE_TYPE_UNREGISTERED: 'node:type_unregistered',
  NODE_CATEGORY_REGISTERED: 'node:category_registered',
  NODE_CREATED: 'node:created',
  NODE_PROPERTY_REMOVED: 'node:property_removed',
  NODE_PROPERTY_BATCH_COMPLETED: 'node:property_batch_completed'
} as const

export type GraphEventType = typeof GraphEventTypes[keyof typeof GraphEventTypes]

// ============================================================================
// Event Data Interfaces
// ============================================================================

export interface BaseGraphEvent {
  type: GraphEventType
  timestamp: number
  source?: string
}

export interface NodeEvent extends BaseGraphEvent {
  node: IComfyGraphNode
  previousValue?: any
  newValue?: any
}

export interface LinkEvent extends BaseGraphEvent {
  link: IComfyGraphLink
  sourceNode: IComfyGraphNode
  targetNode: IComfyGraphNode
}

export interface WidgetEvent extends BaseGraphEvent {
  node: IComfyGraphNode
  widgetName: string
  previousValue: any
  newValue: any
  widget: any
}

export interface ExecutionEvent extends BaseGraphEvent {
  nodeId?: number
  nodeType?: string
  progress?: number
  error?: string
  output?: any
}

export interface ValidationEvent extends BaseGraphEvent {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface CanvasEvent extends BaseGraphEvent {
  position?: [number, number]
  zoom?: number
  button?: number
}

export interface WorkflowEvent extends BaseGraphEvent {
  workflowName?: string
  filePath?: string
  size?: number
  nodeCount?: number
}

export interface ErrorEvent extends BaseGraphEvent {
  error: Error | string
  context?: any
  stack?: string
}

// Union type for all events
export type GraphEvent = 
  | NodeEvent 
  | LinkEvent 
  | WidgetEvent 
  | ExecutionEvent 
  | ValidationEvent 
  | CanvasEvent 
  | WorkflowEvent 
  | ErrorEvent
  | BaseGraphEvent

// ============================================================================
// Event Handler Types
// ============================================================================

export type EventHandler<T extends GraphEvent = GraphEvent> = (event: T) => void
export type EventFilter<T extends GraphEvent = GraphEvent> = (event: T) => boolean

export interface EventSubscription {
  id: string
  type: GraphEventType | GraphEventType[]
  handler: EventHandler
  filter?: EventFilter
  once?: boolean
  priority?: number
}

// ============================================================================
// GraphEventSystem Module State
// ============================================================================

// Module-level state
let subscriptions: Map<GraphEventType, EventSubscription[]> = new Map()
let eventHistory: GraphEvent[] = []
let maxHistorySize: number = 1000
let isEnabled: boolean = true
let debugMode: boolean = false

/**
 * Initialize the event system with options
 */
export function initializeEventSystem(options: {
  maxHistorySize?: number
  debugMode?: boolean
} = {}): void {
  maxHistorySize = options.maxHistorySize ?? 1000
  debugMode = options.debugMode ?? false
}
  
/**
 * Subscribe to an event
 */
export function on<T extends GraphEvent = GraphEvent>(
  eventType: GraphEventType | GraphEventType[],
  handler: EventHandler<T>,
  options: {
    once?: boolean
    priority?: number
    filter?: EventFilter<T>
  } = {}
): string {
  const subscription: EventSubscription = {
    id: generateId(),
    type: eventType,
    handler: handler as EventHandler,
    filter: options.filter as EventFilter,
    once: options.once,
    priority: options.priority ?? 0
  }
  
  const types = Array.isArray(eventType) ? eventType : [eventType]
  
  for (const type of types) {
    if (!subscriptions.has(type)) {
      subscriptions.set(type, [])
    }
    
    const subs = subscriptions.get(type)!
    subs.push(subscription)
    
    // Sort by priority (higher first)
    subs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }
  
  return subscription.id
}
  
/**
 * Subscribe to an event once
 */
export function once<T extends GraphEvent = GraphEvent>(
  eventType: GraphEventType | GraphEventType[],
  handler: EventHandler<T>,
  options: {
    priority?: number
    filter?: EventFilter<T>
  } = {}
): string {
  return on(eventType, handler, { ...options, once: true })
}
  
/**
 * Unsubscribe from an event
 */
export function off(subscriptionId: string): boolean {
  let removed = false
  
  for (const [type, subs] of subscriptions) {
    const index = subs.findIndex(sub => sub.id === subscriptionId)
    if (index >= 0) {
      subs.splice(index, 1)
      removed = true
    }
    
    // Clean up empty subscription arrays
    if (subs.length === 0) {
      subscriptions.delete(type)
    }
  }
  
  return removed
}
  
/**
 * Emit an event
 */
export function emit<T extends GraphEvent = GraphEvent>(
  eventType: GraphEventType,
  eventData: Omit<T, 'type' | 'timestamp'> = {} as any
): void {
  if (!isEnabled) return
  
  const event: GraphEvent = {
    type: eventType,
    timestamp: Date.now(),
    ...eventData
  } as GraphEvent
  
  // Add to history
  addToHistory(event)
  
  // Debug logging
  if (debugMode) {
  }
  
  // Get subscribers
  const subs = subscriptions.get(eventType) || []
  const toRemove: string[] = []
  
  // Call handlers
  for (const subscription of subs) {
    try {
      // Apply filter if present
      if (subscription.filter && !subscription.filter(event)) {
        continue
      }
      
      // Call handler
      subscription.handler(event)
      
      // Mark for removal if it's a one-time subscription
      if (subscription.once) {
        toRemove.push(subscription.id)
      }
    } catch (error) {
      console.error(`[GraphEventSystem] Error in event handler for ${eventType}:`, error)
      
      // Emit error event (prevent recursion)
      if (eventType !== GraphEventTypes.ERROR_OCCURRED) {
        emit(GraphEventTypes.ERROR_OCCURRED, {
          error: error as Error,
          context: { eventType, subscription: subscription.id }
        } as any)
      }
    }
  }
  
  // Remove one-time subscriptions
  for (const id of toRemove) {
    off(id)
  }
}
  
/**
 * Get event history
 */
export function getHistory(
  filter?: {
    types?: GraphEventType[]
    since?: number
    limit?: number
  }
): GraphEvent[] {
  let history = [...eventHistory]
  
  if (filter) {
    if (filter.types) {
      history = history.filter(event => filter.types!.includes(event.type))
    }
    
    if (filter.since) {
      history = history.filter(event => event.timestamp >= filter.since!)
    }
    
    if (filter.limit) {
      history = history.slice(-filter.limit)
    }
  }
  
  return history
}
  
/**
 * Clear event history
 */
export function clearHistory(): void {
  eventHistory = []
}
  
/**
 * Enable or disable event system
 */
export function setEnabled(enabled: boolean): void {
  isEnabled = enabled
}
  
/**
 * Check if event system is enabled
 */
export function isEventSystemEnabled(): boolean {
  return isEnabled
}
  
/**
 * Set debug mode
 */
export function setDebugMode(enabled: boolean): void {
  debugMode = enabled
}
  
/**
 * Get subscription count for an event type
 */
export function getSubscriptionCount(eventType: GraphEventType): number {
  return subscriptions.get(eventType)?.length ?? 0
}
  
/**
 * Get all active event types
 */
export function getActiveEventTypes(): GraphEventType[] {
  return Array.from(subscriptions.keys())
}
  
/**
 * Remove all subscriptions
 */
export function removeAllSubscriptions(): void {
  subscriptions.clear()
}
  
/**
 * Create a scoped event system
 */
export function createScope(prefix: string): ScopedEventSystem {
  return new ScopedEventSystem(prefix)
}
  
// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Emit node added event
 */
export function emitNodeAdded(node: IComfyGraphNode): void {
  emit(GraphEventTypes.NODE_ADDED, { node } as any)
}
  
/**
 * Emit node removed event
 */
export function emitNodeRemoved(node: IComfyGraphNode): void {
  emit(GraphEventTypes.NODE_REMOVED, { node } as any)
}
  
/**
 * Emit widget value changed event
 */
export function emitWidgetValueChanged(
  node: IComfyGraphNode,
  widgetName: string,
  previousValue: any,
  newValue: any,
  widget: any
): void {
  emit(GraphEventTypes.WIDGET_VALUE_CHANGED, {
    node,
    widgetName,
    previousValue,
    newValue,
    widget
  } as any)
}
  
/**
 * Emit execution started event
 */
export function emitExecutionStarted(): void {
  emit(GraphEventTypes.EXECUTION_STARTED)
}
  
/**
 * Emit execution completed event
 */
export function emitExecutionCompleted(): void {
  emit(GraphEventTypes.EXECUTION_COMPLETED)
}
  
// ============================================================================
// Private Functions
// ============================================================================

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
  
function addToHistory(event: GraphEvent): void {
  eventHistory.push(event)
  
  // Trim history if too large
  if (eventHistory.length > maxHistorySize) {
    eventHistory = eventHistory.slice(-maxHistorySize)
  }
}

// ============================================================================
// Scoped Event System
// ============================================================================

export class ScopedEventSystem {
  private subscriptionIds: string[] = []
  private prefix: string
  
  constructor(prefix: string) {
    this.prefix = prefix
  }
  
  on<T extends GraphEvent = GraphEvent>(
    eventType: GraphEventType | GraphEventType[],
    handler: EventHandler<T>,
    options?: {
      once?: boolean
      priority?: number
      filter?: EventFilter<T>
    }
  ): string {
    const id = on(eventType, handler, options)
    this.subscriptionIds.push(id)
    return id
  }
  
  once<T extends GraphEvent = GraphEvent>(
    eventType: GraphEventType | GraphEventType[],
    handler: EventHandler<T>,
    options?: {
      priority?: number
      filter?: EventFilter<T>
    }
  ): string {
    const id = once(eventType, handler, options)
    this.subscriptionIds.push(id)
    return id
  }
  
  emit<T extends GraphEvent = GraphEvent>(
    eventType: GraphEventType,
    eventData?: Omit<T, 'type' | 'timestamp'>
  ): void {
    // Add prefix to source if not present
    const data = {
      ...eventData,
      source: (eventData as any)?.source || this.prefix
    }
    emit(eventType, data as any)
  }
  
  destroy(): void {
    // Remove all subscriptions created by this scope
    for (const id of this.subscriptionIds) {
      off(id)
    }
    this.subscriptionIds = []
  }
}

// ============================================================================
// Initialize default instance
// ============================================================================

// Initialize with default options
initializeEventSystem({ debugMode: false })