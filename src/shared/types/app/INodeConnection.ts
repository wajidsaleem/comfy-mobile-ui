/**
 * Node Connection Types
 */

export interface NodeConnection {
  origin_id: number;
  origin_slot: number;
  target_id: number;
  target_slot: number;
}

export interface NodeInput {
  name: string;
  type: string;
  link?: number;
}

export interface NodeOutput {
  name: string;
  type: string;
  links?: number[];
}