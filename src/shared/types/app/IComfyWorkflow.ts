/**
 * ComfyUI Workflow Types
 */

import type { IComfyJson, IComfyGraph } from './base'

export interface IComfyWorkflow {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  version?: string;
  revision?: number;
  modifiedAt?: Date;
  createdAt: Date;
  workflow_json: IComfyJson;
  graph?: IComfyGraph;
  nodeCount: number;
  thumbnail?: string;
  parsedData?: any;
  isValid: boolean;
  author?: string;
  sortOrder?: number;
}

export interface Workflow extends IComfyWorkflow {}

export interface WorkflowNode {
  id: number;
  type: string;
  pos: [number, number];
  size: [number, number];
  widgets_values?: any[];
  inputs?: any[];
  outputs?: any[];
  flags?: any;
  order?: number;
  mode?: number;
  title?: string;
  // Group node additional information
  groupInfo?: {
    groupId: number;
    title: string;
    nodeIds: number[];
    nodes: WorkflowNode[];
  };
}

// Additional workflow-related types
export interface IWorkflowConfig {
  [key: string]: any;
}

export interface IWorkflowExtra {
  ds?: {
    scale: number;
    offset: [number, number];
  };
  workspace_info?: {
    id: string;
  };
  [key: string]: any;
}

// API Format (when queuing prompt)
export interface IAPIWorkflow {
  [nodeId: string]: {
    inputs: Record<string, any>;
    class_type: string;
    _meta?: {
      title?: string;
    };
  };
}

// Widget value types
export type WidgetValue = string | number | boolean | null | undefined;

// Node dependency graph
export interface INodeDependency {
  nodeId: number;
  upstreamNodes: number[];
  downstreamNodes: number[];
}

// Execution order
export interface IExecutionOrder {
  nodeId: number;
  order: number;
}