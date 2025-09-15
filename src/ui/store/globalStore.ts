import { IComfyWorkflow } from '@/shared/types/app/IComfyWorkflow';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { IComfyObjectInfo } from '@/shared/types/comfy/IComfyObjectInfo';
import { loadAllWorkflows } from '@/infrastructure/storage/WorkflowStorageService';

interface GlobalState {
  // Workflow
  workflows: IComfyWorkflow[];
  workflow: IComfyWorkflow | null; 
  objectInfo: IComfyObjectInfo | null;
  
  // Selected node in workflow
  selectedNodeId: string | null;
    
  // Actions  
  addWorkflow: (workflow: IComfyWorkflow) => void;
  removeWorkflow: (workflowId: string) => void;
  setWorkflow: (workflow: IComfyWorkflow | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  
  // Graph/Node access functions - workflow based
  getSelectedGraph: () => any | null;
  getSelectedNode: () => any | null;
  getNodes: () => any[];
  getLinks: () => any[];
  getGroups: () => any[];
  
  // Calculated values
  isSelectedWorkflow: () => boolean;
}

export const useGlobalStore = create<GlobalState>()(
  devtools(
    (set, get) => ({
      // Initial state
      workflows: loadAllWorkflows(),
      workflow: null,
      objectInfo: null,
      selectedNodeId: null,
      
      // Actions
      addWorkflow: (workflow: IComfyWorkflow) => {
        set((state) => ({
          workflows: [...state.workflows, workflow],
        }));
      },
      removeWorkflow: (workflowId: string) => {
        set((state) => ({
          workflows: state.workflows.filter((workflow) => workflow.id !== workflowId),
        }));
      },
      setWorkflow: (workflow: IComfyWorkflow | null) => {
        set({ workflow, selectedNodeId: null }); // When workflow changes, reset selected node
      },
      setSelectedNode: (nodeId: string | null) => {
        set({ selectedNodeId: nodeId });
      },
      
      // Graph/Node access functions - workflow based
      getSelectedGraph: () => {
        const state = get();
        return state.workflow?.graph || null;
      },
      getSelectedNode: () => {
        const state = get();
        if (!state.workflow?.graph || !state.selectedNodeId) return null;
        
        const graph = state.workflow.graph;
        if (graph._nodes) {
          return graph._nodes.find((node: any) => node.id?.toString() === state.selectedNodeId) || null;
        }
        return null;
      },
      getNodes: () => {
        const state = get();
        return state.workflow?.graph?._nodes || [];
      },
      getLinks: () => {
        const state = get();
        const graph = state.workflow?.graph;
        if (!graph?._links) return [];
        
        // _links is Record<number, IComfyGraphLink> type, convert to array
        if (typeof graph._links === 'object' && !Array.isArray(graph._links)) {
          return Object.values(graph._links);
        }
        return graph._links || [];
      },
      getGroups: () => {
        const state = get();
        return state.workflow?.graph?._groups || [];
      },
      
      // Calculated values
      isSelectedWorkflow: () => {
        return get().workflow !== null;
      },
    }),
    {
      name: 'global-store',
    }
  )
);