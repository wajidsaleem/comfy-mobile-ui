/**
 * Comprehensive Graph Value Change Logging System
 * 
 * This system tracks ALL value changes in the graph, including:
 * - Direct property access (node.widgets_values[index] = value)
 * - Object property changes (node.widgets_values.param = value)
 * - Setter method calls (node.setWidgetValue())
 * - Array modifications (push, splice, etc.)
 */

export interface ValueChangeEvent {
  timestamp: number;
  nodeId: number | string;
  nodeType?: string;
  changeType: 'direct_access' | 'setter_method' | 'array_method' | 'object_property' | 'link_change' | 'node_property' | 'graph_structure';
  path: string; // e.g., "widgets_values[0]", "pos", "inputs[0].link", "_links[1]"
  oldValue: any;
  newValue: any;
  stackTrace?: string;
  source?: string; // Which function/component triggered the change
  linkId?: number; // For link-related changes
  targetNodeId?: number; // For link changes - target node
}

export class GraphChangeLogger {
  private static instance: GraphChangeLogger | null = null;
  private isEnabled = true;
  private changeHistory: ValueChangeEvent[] = [];
  private maxHistorySize = 1000;

  private constructor() {}

  static getInstance(): GraphChangeLogger {
    if (!this.instance) {
      this.instance = new GraphChangeLogger();
    }
    return this.instance;
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🔧 GraphChangeLogger ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current logging status
   */
  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Log a value change event
   */
  logChange(event: Omit<ValueChangeEvent, 'timestamp' | 'stackTrace'>): void {
    if (!this.isEnabled) return;

    const fullEvent: ValueChangeEvent = {
      ...event,
      timestamp: Date.now(),
      stackTrace: this.getStackTrace()
    };

    // Add to history
    this.changeHistory.push(fullEvent);
    
    // Maintain history size limit
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }

    // Console log with color coding
    this.logToConsole(fullEvent);
  }

  /**
   * Get change history
   */
  getChangeHistory(): ValueChangeEvent[] {
    return [...this.changeHistory];
  }

  /**
   * Get changes for specific node
   */
  getNodeChanges(nodeId: number | string): ValueChangeEvent[] {
    return this.changeHistory.filter(change => change.nodeId === nodeId);
  }

  /**
   * Clear change history
   */
  clearHistory(): void {
    this.changeHistory = [];
    console.log('🔧 GraphChangeLogger history cleared');
  }

  /**
   * Get recent changes (last N changes)
   */
  getRecentChanges(count = 10): ValueChangeEvent[] {
    return this.changeHistory.slice(-count);
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(event: ValueChangeEvent): void {
    const emoji = this.getChangeEmoji(event.changeType);
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    
    console.group(`${emoji} Graph Change [${timestamp}]`);
    console.log(`Node: ${event.nodeId} (${event.nodeType || 'unknown'})`);
    console.log(`Type: ${event.changeType}`);
    console.log(`Path: ${event.path}`);
    console.log(`Value: %c${JSON.stringify(event.oldValue)} %c→ %c${JSON.stringify(event.newValue)}`, 
      'color: #ff6b6b', 'color: #666', 'color: #51cf66');
    
    if (event.source) {
      console.log(`Source: ${event.source}`);
    }
    
    if (event.stackTrace) {
      console.log(`Stack trace: ${event.stackTrace.split('\n')[1]}`); // Show caller
    }
    console.groupEnd();
  }

  /**
   * Get emoji for change type
   */
  private getChangeEmoji(changeType: ValueChangeEvent['changeType']): string {
    switch (changeType) {
      case 'direct_access': return '🎯';
      case 'setter_method': return '🔧';
      case 'array_method': return '📝';
      case 'object_property': return '🏷️';
      case 'link_change': return '🔗';
      case 'node_property': return '📍';
      case 'graph_structure': return '🏗️';
      default: return '🔄';
    }
  }

  /**
   * Get current stack trace
   */
  private getStackTrace(): string {
    const stack = new Error().stack || '';
    return stack.split('\n').slice(3, 8).join('\n'); // Skip first 3 lines
  }
}

/**
 * Create a proxy wrapper for widgets_values to track all changes
 */
export function createWidgetsValuesProxy(
  target: any, 
  nodeId: number | string, 
  nodeType?: string
): any {
  const logger = GraphChangeLogger.getInstance();

  if (!target) return target;

  // Handle array widgets_values
  if (Array.isArray(target)) {
    return new Proxy(target, {
      set(obj: any[], prop: string | symbol, newValue: any): boolean {
        const oldValue = obj[prop as any];
        
        if (prop !== 'length' && typeof prop !== 'symbol') {
          logger.logChange({
            nodeId,
            nodeType,
            changeType: 'direct_access',
            path: `widgets_values[${prop}]`,
            oldValue,
            newValue,
            source: 'Array Direct Access'
          });
        }

        obj[prop as any] = newValue;
        return true;
      },

      get(obj: any[], prop: string | symbol): any {
        const value = obj[prop as any];

        // Intercept array methods that modify the array
        if (typeof value === 'function' && ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop as string)) {
          return function(...args: any[]) {
            const oldArray = [...obj];
            const result = (value as Function).apply(obj, args);
            
            logger.logChange({
              nodeId,
              nodeType,
              changeType: 'array_method',
              path: `widgets_values.${prop as string}()`,
              oldValue: oldArray,
              newValue: [...obj],
              source: `Array ${prop as string} method`
            });

            return result;
          };
        }

        return value;
      }
    });
  }

  // Handle object widgets_values
  if (typeof target === 'object' && target !== null) {
    return new Proxy(target, {
      set(obj: any, prop: string | symbol, newValue: any): boolean {
        const oldValue = obj[prop];
        
        if (typeof prop !== 'symbol') {
          logger.logChange({
            nodeId,
            nodeType,
            changeType: 'object_property',
            path: `widgets_values.${prop as string}`,
            oldValue,
            newValue,
            source: 'Object Property Access'
          });
        }

        obj[prop] = newValue;
        return true;
      },

      deleteProperty(obj: any, prop: string | symbol): boolean {
        const oldValue = obj[prop];
        
        if (typeof prop !== 'symbol') {
          logger.logChange({
            nodeId,
            nodeType,
            changeType: 'object_property',
            path: `widgets_values.${prop as string}`,
            oldValue,
            newValue: undefined,
            source: 'Object Property Delete'
          });
        }

        delete obj[prop];
        return true;
      }
    });
  }

  return target;
}

/**
 * Create proxy for node inputs to track link changes
 */
export function createInputsProxy(target: any[], nodeId: number | string, nodeType?: string): any[] {
  const logger = GraphChangeLogger.getInstance();

  if (!Array.isArray(target)) return target;

  return new Proxy(target, {
    set(obj: any[], prop: string | symbol, newValue: any): boolean {
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        const index = Number(prop);
        const oldInput = obj[index];
        
        // If this is a link change
        if (newValue && typeof newValue === 'object' && 'link' in newValue) {
          if (oldInput && oldInput.link !== newValue.link) {
            logger.logChange({
              nodeId,
              nodeType,
              changeType: 'link_change',
              path: `inputs[${index}].link`,
              oldValue: oldInput.link,
              newValue: newValue.link,
              source: 'Input Link Change'
            });
          }
        }
      }

      obj[prop as any] = newValue;
      return true;
    },

    get(obj: any[], prop: string | symbol): any {
      const value = obj[prop as any];

      // Wrap individual input objects
      if (typeof prop === 'string' && !isNaN(Number(prop)) && value && typeof value === 'object') {
        return new Proxy(value, {
          set(inputObj: any, inputProp: string | symbol, inputNewValue: any): boolean {
            if (inputProp === 'link') {
              const oldValue = inputObj[inputProp];
              
              logger.logChange({
                nodeId,
                nodeType,
                changeType: 'link_change',
                path: `inputs[${prop}].link`,
                oldValue,
                newValue: inputNewValue,
                source: 'Input Link Direct Assignment'
              });
            }
            
            inputObj[inputProp] = inputNewValue;
            return true;
          }
        });
      }

      return value;
    }
  });
}

/**
 * Create proxy for node outputs to track link changes
 */
export function createOutputsProxy(target: any[], nodeId: number | string, nodeType?: string): any[] {
  const logger = GraphChangeLogger.getInstance();

  if (!Array.isArray(target)) return target;

  return new Proxy(target, {
    get(obj: any[], prop: string | symbol): any {
      const value = obj[prop as any];

      // Wrap individual output objects
      if (typeof prop === 'string' && !isNaN(Number(prop)) && value && typeof value === 'object') {
        return new Proxy(value, {
          set(outputObj: any, outputProp: string | symbol, outputNewValue: any): boolean {
            if (outputProp === 'links') {
              const oldValue = outputObj[outputProp];
              
              logger.logChange({
                nodeId,
                nodeType,
                changeType: 'link_change',
                path: `outputs[${prop}].links`,
                oldValue,
                newValue: outputNewValue,
                source: 'Output Links Assignment'
              });
            }
            
            outputObj[outputProp] = outputNewValue;
            return true;
          }
        });
      }

      return value;
    }
  });
}

/**
 * Wrap a node to track ALL changes (widgets, links, properties, position, etc.)
 */
export function wrapNodeForLogging(node: any): any {
  if (!node) return node;

  const logger = GraphChangeLogger.getInstance();

  // Create proxy for widgets_values if it exists
  if (node.widgets_values) {
    node.widgets_values = createWidgetsValuesProxy(
      node.widgets_values, 
      node.id, 
      node.type
    );
  }

  // Create proxy for inputs to track link changes
  if (node.inputs && Array.isArray(node.inputs)) {
    node.inputs = createInputsProxy(node.inputs, node.id, node.type);
  }

  // Create proxy for outputs to track link changes
  if (node.outputs && Array.isArray(node.outputs)) {
    node.outputs = createOutputsProxy(node.outputs, node.id, node.type);
  }

  // Intercept ALL property changes on the node
  return new Proxy(node, {
    set(obj: any, prop: string | symbol, newValue: any): boolean {
      const oldValue = obj[prop];
      let shouldLog = false;
      let changeType: ValueChangeEvent['changeType'] = 'node_property';
      let source = 'Node Property Change';

      // Determine what kind of change this is
      if (prop === 'widgets_values') {
        changeType = 'direct_access';
        source = 'widgets_values Assignment';
        // Wrap the new value with proxy too
        newValue = createWidgetsValuesProxy(newValue, obj.id, obj.type);
        shouldLog = true;
      } else if (prop === 'pos') {
        changeType = 'node_property';
        source = 'Node Position Change';
        shouldLog = true;
      } else if (prop === 'size') {
        changeType = 'node_property';
        source = 'Node Size Change';
        shouldLog = true;
      } else if (prop === 'title') {
        changeType = 'node_property';
        source = 'Node Title Change';
        shouldLog = true;
      } else if (prop === 'mode') {
        changeType = 'node_property';
        source = 'Node Mode Change';
        shouldLog = true;
      } else if (prop === 'inputs') {
        changeType = 'node_property';
        source = 'Node Inputs Change';
        newValue = createInputsProxy(newValue, obj.id, obj.type);
        shouldLog = true;
      } else if (prop === 'outputs') {
        changeType = 'node_property';
        source = 'Node Outputs Change';
        newValue = createOutputsProxy(newValue, obj.id, obj.type);
        shouldLog = true;
      } else if (prop === 'color' || prop === 'bgcolor') {
        changeType = 'node_property';
        source = 'Node Color Change';
        shouldLog = true;
      }

      // Log the change if it's something we care about
      if (shouldLog) {
        logger.logChange({
          nodeId: obj.id || 'unknown',
          nodeType: obj.type,
          changeType,
          path: String(prop),
          oldValue,
          newValue,
          source
        });
      }

      obj[prop] = newValue;
      return true;
    }
  });
}

/**
 * Create proxy for graph _links to track link creation/deletion
 */
export function createGraphLinksProxy(target: Record<number, any>): Record<number, any> {
  const logger = GraphChangeLogger.getInstance();

  return new Proxy(target, {
    set(obj: Record<number, any>, prop: string | symbol, newValue: any): boolean {
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        const linkId = Number(prop);
        const oldValue = obj[linkId];
        
        // Log link creation or modification
        logger.logChange({
          nodeId: newValue?.origin_id || 'graph',
          nodeType: 'graph',
          changeType: 'link_change',
          path: `_links[${linkId}]`,
          oldValue,
          newValue,
          source: oldValue ? 'Link Modified' : 'Link Created',
          linkId,
          targetNodeId: newValue?.target_id
        });
      }

      obj[prop as any] = newValue;
      return true;
    },

    deleteProperty(obj: Record<number, any>, prop: string | symbol): boolean {
      if (typeof prop === 'string' && !isNaN(Number(prop))) {
        const linkId = Number(prop);
        const oldValue = obj[linkId];
        
        // Log link deletion
        logger.logChange({
          nodeId: oldValue?.origin_id || 'graph',
          nodeType: 'graph',
          changeType: 'link_change',
          path: `_links[${linkId}]`,
          oldValue,
          newValue: undefined,
          source: 'Link Deleted',
          linkId,
          targetNodeId: oldValue?.target_id
        });
      }

      delete obj[prop as any];
      return true;
    }
  });
}

/**
 * Wrap entire graph to track structure changes
 */
export function wrapGraphForLogging(graph: any): any {
  if (!graph) return graph;

  const logger = GraphChangeLogger.getInstance();

  // Wrap _links if it exists
  if (graph._links && typeof graph._links === 'object') {
    graph._links = createGraphLinksProxy(graph._links);
  }

  // Wrap the graph itself to catch high-level changes
  return new Proxy(graph, {
    set(obj: any, prop: string | symbol, newValue: any): boolean {
      const oldValue = obj[prop];
      let shouldLog = false;
      let changeType: ValueChangeEvent['changeType'] = 'graph_structure';
      let source = 'Graph Structure Change';

      if (prop === '_nodes') {
        shouldLog = true;
        source = 'Graph Nodes Array Change';
        // Wrap new nodes for logging
        if (Array.isArray(newValue)) {
          newValue = newValue.map((node: any) => wrapNodeForLogging(node));
        }
      } else if (prop === '_links') {
        shouldLog = true;
        source = 'Graph Links Object Change';
        // Wrap new links object
        if (newValue && typeof newValue === 'object') {
          newValue = createGraphLinksProxy(newValue);
        }
      } else if (prop === '_groups') {
        shouldLog = true;
        source = 'Graph Groups Change';
      } else if (prop === 'last_node_id' || prop === 'last_link_id') {
        shouldLog = true;
        source = 'Graph ID Counter Change';
      }

      if (shouldLog) {
        logger.logChange({
          nodeId: 'graph',
          nodeType: 'graph',
          changeType,
          path: String(prop),
          oldValue,
          newValue,
          source
        });
      }

      obj[prop] = newValue;
      return true;
    }
  });
}

/**
 * Utility function to wrap all nodes in a graph and the graph itself
 */
export function wrapGraphNodesForLogging(graph: any): any {
  if (!graph || !graph._nodes) return graph;

  // First wrap individual nodes
  graph._nodes = graph._nodes.map((node: any) => wrapNodeForLogging(node));
  
  // Then wrap the entire graph for structure tracking
  const wrappedGraph = wrapGraphForLogging(graph);
  
  console.log(`🔧 GraphChangeLogger: Wrapped ${graph._nodes.length} nodes and graph structure for comprehensive logging`);
  return wrappedGraph;
}

// Export singleton instance for easy access
export const graphChangeLogger = GraphChangeLogger.getInstance();

// Global utility functions
(globalThis as any).__graphLogger = {
  enable: () => graphChangeLogger.setEnabled(true),
  disable: () => graphChangeLogger.setEnabled(false),
  history: () => graphChangeLogger.getChangeHistory(),
  recent: (count?: number) => graphChangeLogger.getRecentChanges(count),
  clear: () => graphChangeLogger.clearHistory(),
  node: (nodeId: number | string) => graphChangeLogger.getNodeChanges(nodeId),
  links: () => graphChangeLogger.getChangeHistory().filter(c => c.changeType === 'link_change'),
  properties: () => graphChangeLogger.getChangeHistory().filter(c => c.changeType === 'node_property'),
  structure: () => graphChangeLogger.getChangeHistory().filter(c => c.changeType === 'graph_structure'),
  widgets: () => graphChangeLogger.getChangeHistory().filter(c => 
    ['direct_access', 'setter_method', 'array_method', 'object_property'].includes(c.changeType)
  ),
  byType: (type: string) => graphChangeLogger.getChangeHistory().filter(c => c.changeType === type)
};

console.log('🔧 GraphChangeLogger initialized. Use __graphLogger in console for debugging');