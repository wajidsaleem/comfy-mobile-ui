import { useCallback, useRef, useEffect, MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import ComfyUIService from '@/infrastructure/api/ComfyApiClient';
import {
  NodeExecutionStartEvent,
  NodeExecutionProgressEvent,
  NodeExecutionCompleteEvent,
  ExecutionCompleteEvent,
  ExecutionErrorEvent
} from '@/shared/types/comfy/IComfyAPI';

export interface WebSocketExecutionState {
  isExecuting: boolean;
  executionPhase: 'idle' | 'preparing' | 'submitted' | 'running' | 'completed';
  currentPromptId: string | null;
  executingNodeId: string | null;
  nodeExecutionProgress: { nodeId: string; progress: number } | null;
  errorNodeId: string | null;
  executionErrors: any[];
  isSingleExecuting: boolean;
  singleExecuteTarget: number | null;
  filteredNodes: Set<number>;
}

interface UseWebSocketConnectionProps {
  serverUrl: string | null;
  workflowId: string | undefined;
  onNodeExecutionComplete?: (event: NodeExecutionCompleteEvent) => void;
  onWorkflowModified?: (workflowId: string, workflow: any) => void;
  currentPromptIdRef: MutableRefObject<string | null>;
  
  // State setters from parent component
  setIsExecuting: (value: boolean) => void;
  setExecutionPhase: (value: WebSocketExecutionState['executionPhase']) => void;
  setCurrentPromptId: (value: string | null) => void;
  setExecutingNodeId: (value: string | null | ((prev: string | null) => string | null)) => void;
  setNodeExecutionProgress: (value: WebSocketExecutionState['nodeExecutionProgress'] | ((prev: WebSocketExecutionState['nodeExecutionProgress']) => WebSocketExecutionState['nodeExecutionProgress'])) => void;
  setErrorNodeId: (value: string | null) => void;
  setExecutionErrors: (value: any[]) => void;
  setIsSingleExecuting: (value: boolean) => void;
  setSingleExecuteTarget: (value: number | null) => void;
  setFilteredNodes: (value: Set<number>) => void;
  
  // Additional state from parent
  isSingleExecuting: boolean;
  singleExecuteTarget: number | null;
}

interface UseWebSocketConnectionReturn {
  comfyUIService: typeof ComfyUIService | null;
  handleExecutionStarted: (event: any) => void;
  handleExecutionRunning: (event: any) => void;
  handleNodeExecutionStart: (event: NodeExecutionStartEvent) => void;
  handleNodeExecutionProgress: (event: NodeExecutionProgressEvent) => void;
  handleNodeExecutionComplete: (event: NodeExecutionCompleteEvent) => void;
  handleExecutionComplete: (event: ExecutionCompleteEvent) => void;
  handleExecutionError: (event: ExecutionErrorEvent) => void;
}

export function useWebSocketConnection({
  serverUrl,
  workflowId,
  onNodeExecutionComplete,
  onWorkflowModified,
  currentPromptIdRef,
  setIsExecuting,
  setExecutionPhase,
  setCurrentPromptId,
  setExecutingNodeId,
  setNodeExecutionProgress,
  setErrorNodeId,
  setExecutionErrors,
  setIsSingleExecuting,
  setSingleExecuteTarget,
  setFilteredNodes,
  isSingleExecuting,
  singleExecuteTarget
}: UseWebSocketConnectionProps): UseWebSocketConnectionReturn {
  const comfyUIServiceRef = useRef<typeof ComfyUIService | null>(null);
  
  // Store values in refs to prevent unnecessary useEffect re-execution
  const workflowIdRef = useRef(workflowId);
  const onWorkflowModifiedRef = useRef(onWorkflowModified);
  
  // Update refs when values change
  workflowIdRef.current = workflowId;
  onWorkflowModifiedRef.current = onWorkflowModified;
  

  // Event Handlers
  const handleExecutionStarted = useCallback((event: any) => {
    setCurrentPromptId(event.promptId);
    currentPromptIdRef.current = event.promptId;
    flushSync(() => {
      setExecutionPhase('submitted');
    });
  }, []);

  const handleExecutionRunning = useCallback((event: any) => {
    flushSync(() => {
      setExecutionPhase('running');
    });
  }, []);

  const handleNodeExecutionStart = useCallback((event: NodeExecutionStartEvent) => {
    if (currentPromptIdRef.current && event.promptId !== currentPromptIdRef.current) {
      return;
    }
    
    
    setIsExecuting(true);
    setExecutingNodeId(event.nodeId);
    setExecutionPhase('running');
  }, []);

  const handleNodeExecutionProgress = useCallback((event: NodeExecutionProgressEvent) => {
    if (currentPromptIdRef.current && event.promptId !== currentPromptIdRef.current) {
      return;
    }
    
    
    setNodeExecutionProgress(prevProgress => {
      if (!prevProgress || prevProgress.nodeId !== event.nodeId) {
        setExecutingNodeId(event.nodeId);
      }
      
      return {
        nodeId: event.nodeId,
        progress: event.progress.percentage
      };
    });
    
  }, []);

  const handleNodeExecutionComplete = useCallback(async (event: NodeExecutionCompleteEvent) => {
    if (currentPromptIdRef.current && event.promptId !== currentPromptIdRef.current) {
      return;
    }
    
    
    flushSync(() => {
      setExecutingNodeId(prev => prev === event.nodeId ? null : prev);
      setNodeExecutionProgress(prev => prev?.nodeId === event.nodeId ? null : prev);
    });
    
    // Call parent's onNodeExecutionComplete handler if provided
    if (onNodeExecutionComplete) {
      onNodeExecutionComplete(event);
    }
  }, [onNodeExecutionComplete]);

  const handleExecutionComplete = useCallback((event: ExecutionCompleteEvent) => {
    console.log('🎯 WorkflowEditor received execution_complete event:', {
      eventPromptId: event.promptId.substring(0, 8),
      currentPromptId: currentPromptIdRef.current ? currentPromptIdRef.current.substring(0, 8) : 'none',
      willHandle: !currentPromptIdRef.current || event.promptId === currentPromptIdRef.current,
      isSingleExecuting,
      completionReason: event.completionReason
    });

    // 🔴 DEBUG: Log interrupt completion specifically
    if (event.completionReason === 'interrupted') {
    }
    
    if (currentPromptIdRef.current && event.promptId !== currentPromptIdRef.current) {
      return;
    }
    
    const wasSingleExecution = isSingleExecuting;
    const singleExecuteTargetNode = singleExecuteTarget;    
    
    flushSync(() => {
      setIsExecuting(false);
      setExecutingNodeId(null);
      setNodeExecutionProgress(null);
      setCurrentPromptId(null);
      currentPromptIdRef.current = null;
      setExecutionPhase('completed');
      setErrorNodeId(null);
      
      // Clean up single execute state
      setIsSingleExecuting(false);
      setSingleExecuteTarget(null);
      setFilteredNodes(new Set());
    });
    
    console.log('📊 UI State after update:', {
      isExecuting: false,
      executingNodeId: null,
      executionPhase: 'completed',
      isSingleExecuting: false,
      filteredNodesCleared: true
    });  

    // Show appropriate toast based on completion reason and execution type
    switch (event.completionReason) {
      case 'interrupted':
        toast.warning(`${wasSingleExecution ? 'Single node execution' : 'Workflow execution'} interrupted`, {
          description: 'Execution has been stopped by user',
          duration: 3000,
        });
        break;
      case 'error':
        // Error toast is already handled by handleExecutionError
        break;
      case 'success':
      case 'executing_null':
      default:
        if (wasSingleExecution && singleExecuteTargetNode) {
          toast.success(`Single node execution completed!`, {
            description: `Node ${singleExecuteTargetNode} and its dependencies have finished processing`,
            duration: 4000,
          });
        } else {
          toast.success('Workflow completed successfully!', {
            description: 'All nodes have finished processing',
          });
        }
        break;
    }

    // Reset to idle after a brief delay
    setTimeout(() => {
      setExecutionPhase('idle');
    }, 2000);
  }, []);

  const handleExecutionError = useCallback((event: ExecutionErrorEvent) => {
    if (currentPromptIdRef.current && event.promptId !== currentPromptIdRef.current) {
      return;
    }
    
    console.error('❌ Workflow execution error:', event.error, 'for prompt:', event.promptId.substring(0, 8));
    
    flushSync(() => {
      setIsExecuting(false);
      setExecutingNodeId(null);
      setNodeExecutionProgress(null);
      setCurrentPromptId(null);
      currentPromptIdRef.current = null;
      setExecutionPhase('idle');
      setErrorNodeId(null);
    });
    
    // Transform the WebSocket execution error for ExecutionErrorDisplay
    const executionError = {
      nodeId: 'system',
      error: {
        type: event.error?.type || 'Execution Error',
        message: event.error?.message || 'An error occurred during workflow execution',
        details: event.error?.details || event.error?.extra_info?.traceback?.join('\n') || JSON.stringify(event.error, null, 2),
        extra_info: {
          promptId: event.promptId,
          executionError: true,
          originalError: event.error,
          exception_type: event.error?.extra_info?.exception_type,
          traceback: event.error?.extra_info?.traceback
        }
      }
    };
    
    setExecutionErrors([executionError]);
    
    // Note: Toast message removed as requested - errors are shown in ErrorViewer modal instead
  }, []);

  // Initialize ComfyUI service and subscribe to events (without affecting global listeners)
  useEffect(() => {
    
    if (serverUrl) {
      comfyUIServiceRef.current = ComfyUIService;
      
      console.log('🔍 [DEBUG] ComfyUIService obtained:', {
        serviceExists: !!ComfyUIService,
        serviceName: 'ComfyUIService'
      });
      
      
      
      // Subscribe to events - store IDs for safe removal
      const listenerIds = [
        ComfyUIService.on('execution_started', handleExecutionStarted),
        ComfyUIService.on('execution_running', handleExecutionRunning),
        ComfyUIService.on('node_execution_start', handleNodeExecutionStart),
        ComfyUIService.on('node_execution_progress', handleNodeExecutionProgress),
        ComfyUIService.on('node_execution_complete', handleNodeExecutionComplete),
        ComfyUIService.on('execution_complete', handleExecutionComplete),
        ComfyUIService.on('execution_error', handleExecutionError)
      ];
      
      
      // Cleanup function - remove only our listeners by ID
      return () => {
        
        // Remove our listeners by ID
        const events = ['execution_started', 'execution_running', 'node_execution_start', 'node_execution_progress', 
                       'node_execution_complete', 'execution_complete', 'execution_error'];
        
        events.forEach((eventName, index) => {
          if (listenerIds[index]) {
            ComfyUIService.offById(eventName, listenerIds[index]);
          }
        });
        
      };
    }
  }, [serverUrl, handleExecutionStarted, handleExecutionRunning, handleNodeExecutionStart, 
      handleNodeExecutionProgress, handleNodeExecutionComplete, handleExecutionComplete, handleExecutionError]);

  return {
    comfyUIService: comfyUIServiceRef.current,
    handleExecutionStarted,
    handleExecutionRunning,
    handleNodeExecutionStart,
    handleNodeExecutionProgress,
    handleNodeExecutionComplete,
    handleExecutionComplete,
    handleExecutionError
  };
}