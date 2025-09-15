import { IComfyJson } from '@/shared/types/app/IComfyJson';

// WorkflowSnapshot type definitions
export interface WorkflowSnapshot {
  workflow_id: string;
  title: string;  // User-defined name for the snapshot
  createdAt: string;  // ISO datetime string
  workflow_snapshot: IComfyJson;  // The actual workflow JSON data
}

export interface WorkflowSnapshotFile {
  filename: string;  // The actual JSON filename
  snapshot: WorkflowSnapshot;
}

export interface WorkflowSnapshotListItem {
  workflow_id: string;
  title: string;
  createdAt: string;
  filename: string;
  fileSize: number;  // File size in bytes
}

// API Request/Response types
export interface SaveSnapshotRequest {
  workflow_id: string;
  title: string;
  workflow_snapshot: IComfyJson;
}

export interface SaveSnapshotResponse {
  success: boolean;
  message?: string;
  error?: string;
  filename?: string;
  snapshot?: WorkflowSnapshot;
}

export interface LoadSnapshotResponse {
  success: boolean;
  message?: string;
  error?: string;
  snapshot?: WorkflowSnapshot;
}

export interface ListSnapshotsResponse {
  success: boolean;
  message?: string;
  error?: string;
  snapshots: WorkflowSnapshotListItem[];
  total_count: number;
}

export interface ListSnapshotsByWorkflowResponse {
  success: boolean;
  message?: string;
  error?: string;
  workflow_id: string;
  snapshots: WorkflowSnapshotListItem[];
  total_count: number;
}

export interface DeleteSnapshotResponse {
  success: boolean;
  message?: string;
  error?: string;
  filename?: string;
}