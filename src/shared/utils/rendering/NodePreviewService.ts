import ComfyUIService from '../../../infrastructure/api/ComfyApiClient';

// Types for node execution completion data
interface NodeExecutionCompleteData {
  type: 'node_execution_complete';
  promptId: string;
  nodeId: string;
  outputs: {
    images?: Array<{
      filename: string;
      subfolder: string;
      type: string;
    }>;
    gifs?: Array<{
      filename: string;
      subfolder: string;
      type: string;
    }>;
  };
  timestamp: number;
}

// Types for preview parameters
interface ImagePreviewParams {
  filename: string;
  subfolder: string;
  type: string;
}

interface VideoPreviewParams {
  filename: string;
  subfolder: string;
  type: string;
  format?: string;
}

// Event types for the NodePreviewManager
interface NodePreviewManagerEvents {
  'preview_added': {
    nodeId: string;
    previewType: 'image' | 'video';
    previewData: ImagePreviewParams | VideoPreviewParams;
  };
}

/**
 * NodePreviewManager handles automatic addition of imagepreview/videopreview
 * to workflow nodes based on ComfyUI execution output messages.
 * 
 * It subscribes to 'node_execution_complete' events from ComfyUIService
 * and dynamically adds preview sections to nodes when they produce
 * image or video outputs.
 */
export class NodePreviewManager {
  private static instance: NodePreviewManager | null = null;
  private isInitialized = false;
  private currentWorkflow: any = null;
  private modifiedWidgetValues: Map<number, Record<string, any>> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private boundHandler: Function | null = null;

  constructor() {}

  /**
   * Simple event system
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NodePreviewManager {
    if (!this.instance) {
      this.instance = new NodePreviewManager();
    }
    return this.instance;
  }

  /**
   * Initialize the preview manager with workflow context
   */
  initialize(workflow: any, modifiedWidgetValues: Map<number, Record<string, any>>): void {
    console.log('🚀 @@@@ NodePreviewManager: initialize() called', {
      workflow: workflow?.name || 'unnamed',
      workflowId: workflow?.id,
      hasWorkflow: !!workflow,
      modifiedWidgetValuesSize: modifiedWidgetValues.size,
      wasAlreadyInitialized: this.isInitialized
    });
    
    if (this.isInitialized) {
      this.cleanup();
    }

    this.currentWorkflow = workflow;
    this.modifiedWidgetValues = modifiedWidgetValues;
    this.setupEventListeners();
    this.isInitialized = true;

  }

  /**
   * Setup event listeners for ComfyUIService messages
   */
  private setupEventListeners(): void {
    // Use same pattern as useCanvasRenderer - local service reference
    const comfyUIService = ComfyUIService;
    
    // Create handler function using same pattern as working components
    this.boundHandler = (event: any) => {
      this.handleNodeExecutionComplete(event);
    };
    
    console.log('🔗 @@@@ NodePreviewManager: Setting up event listeners', {
      comfyUIServiceExists: !!comfyUIService,
      handlerBound: !!this.boundHandler,
      currentListenerCount: comfyUIService.getListenerCount('node_execution_complete')
    });
    
    comfyUIService.on('node_execution_complete', this.boundHandler);
    
    const newListenerCount = comfyUIService.getListenerCount('node_execution_complete');
  }

  /**
   * Handle node execution complete events
   */
  private handleNodeExecutionComplete(event: any): void {
    try {
      // console.log('🔔 @@@@ NodePreviewManager: handleNodeExecutionComplete called with event:', event);
      
      // if (!this.currentWorkflow) {
      //   console.log('❌ @@@@ NodePreviewManager: No current workflow, skipping');
      //   return;
      // }
      
      // if (!event.outputs) {
      //   console.log('❌ @@@@ NodePreviewManager: No outputs in event, skipping');
      //   return;
      // }

      // const nodeId = parseInt(event.nodeId);
      // console.log(`🎯 @@@@ NodePreviewManager: Processing node ${nodeId} with outputs:`, event.outputs);

      // // Check for image outputs
      // if (event.outputs.images && event.outputs.images.length > 0) {
      //   console.log(`🖼️ @@@@ NodePreviewManager: Found ${event.outputs.images.length} images for node ${nodeId}`);
      //   this.addImagePreview(nodeId, event.outputs.images[0]);
      // } else {
      //   console.log(`❓ @@@@ NodePreviewManager: No images found for node ${nodeId}`);
      // }

      // // Check for video/gif outputs
      // if (event.outputs.gifs && event.outputs.gifs.length > 0) {
      //   console.log(`🎥 @@@@ NodePreviewManager: Found ${event.outputs.gifs.length} gifs for node ${nodeId}`);
      //   this.addVideoPreview(nodeId, event.outputs.gifs[0]);
      // } else {
      //   console.log(`❓ @@@@ NodePreviewManager: No gifs found for node ${nodeId}`);
      // }
      
      // console.log('✅ @@@@ NodePreviewManager: handleNodeExecutionComplete completed successfully');
    } catch (error) {
      console.error('❌ @@@@ NodePreviewManager: Error in handleNodeExecutionComplete:', error);
      console.error('❌ @@@@ NodePreviewManager: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ @@@@ NodePreviewManager: Input event that caused error:', JSON.stringify(event, null, 2));
    }
  }

  /**
   * Add imagepreview to a node
   */
  private addImagePreview(nodeId: number, imageOutput: { filename: string; subfolder: string; type: string }): void {
    const imagePreviewParams: ImagePreviewParams = {
      filename: imageOutput.filename,
      subfolder: imageOutput.subfolder,
      type: imageOutput.type
    };

    // COMMENTED OUT: Runtime preview insertion logic (will be replaced with new approach)
    /*
    // Get current node modifications or create new ones
    const currentNodeValues = this.modifiedWidgetValues.get(nodeId) || {};

    // Add imagepreview.params structure
    const updatedValues = {
      ...currentNodeValues,
      imagepreview: {
        params: imagePreviewParams
      }
    };

    // Update the modified widget values
    this.modifiedWidgetValues.set(nodeId, updatedValues);
    */

    console.log(`🖼️ @@@@ NodePreviewManager: Would add imagepreview to node ${nodeId} (COMMENTED OUT):`, {
      nodeId,
      filename: imageOutput.filename,
      subfolder: imageOutput.subfolder,
      type: imageOutput.type,
      fullPreviewParams: imagePreviewParams
    });

    // COMMENTED OUT: Event emission for preview insertion
    /*
    // Emit event for components to react
    this.emit('preview_added', {
      nodeId: nodeId.toString(),
      previewType: 'image',
      previewData: imagePreviewParams
    });
    
    console.log(`📢 @@@@ NodePreviewManager: Emitted preview_added event for node ${nodeId}`, {
      nodeId: nodeId.toString(),
      previewType: 'image',
      previewData: imagePreviewParams
    });
    */
  }

  /**
   * Add videopreview to a node
   */
  private addVideoPreview(nodeId: number, videoOutput: { filename: string; subfolder: string; type: string }): void {
    const videoPreviewParams: VideoPreviewParams = {
      filename: videoOutput.filename,
      subfolder: videoOutput.subfolder,
      type: videoOutput.type,
      format: this.getVideoFormat(videoOutput.filename)
    };

    // COMMENTED OUT: Runtime preview insertion logic (will be replaced with new approach)
    /*
    // Get current node modifications or create new ones
    const currentNodeValues = this.modifiedWidgetValues.get(nodeId) || {};

    // Add videopreview.params structure
    const updatedValues = {
      ...currentNodeValues,
      videopreview: {
        params: videoPreviewParams
      }
    };

    // Update the modified widget values
    this.modifiedWidgetValues.set(nodeId, updatedValues);
    */

    console.log(`🎥 @@@@ NodePreviewManager: Would add videopreview to node ${nodeId} (COMMENTED OUT):`, {
      nodeId,
      filename: videoOutput.filename,
      subfolder: videoOutput.subfolder,
      type: videoOutput.type,
      format: this.getVideoFormat(videoOutput.filename),
      fullPreviewParams: videoPreviewParams
    });

    // COMMENTED OUT: Event emission for preview insertion
    /*
    // Emit event for components to react
    this.emit('preview_added', {
      nodeId: nodeId.toString(),
      previewType: 'video',
      previewData: videoPreviewParams
    });
    
    console.log(`📢 @@@@ NodePreviewManager: Emitted preview_added event for node ${nodeId}`, {
      nodeId: nodeId.toString(),
      previewType: 'video',
      previewData: videoPreviewParams
    });
    */
  }

  /**
   * Determine video format from filename
   */
  private getVideoFormat(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop() || '';
    
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'gif':
        return 'image/gif';
      default:
        return 'video/mp4'; // Default fallback
    }
  }

  /**
   * Get current modified widget values map
   */
  getModifiedWidgetValues(): Map<number, Record<string, any>> {
    return this.modifiedWidgetValues;
  }

  /**
   * Update the widget values map reference
   */
  updateWidgetValuesReference(modifiedWidgetValues: Map<number, Record<string, any>>): void {
    this.modifiedWidgetValues = modifiedWidgetValues;
  }

  /**
   * Check if a node has preview data
   * NOTE: Since runtime insertion is commented out, this will only return true for pre-existing previews
   */
  hasPreview(nodeId: number): boolean {
    const nodeValues = this.modifiedWidgetValues.get(nodeId);
    return !!(nodeValues?.imagepreview?.params || nodeValues?.videopreview?.params);
  }

  /**
   * Get preview data for a node
   * NOTE: Since runtime insertion is commented out, this will only return pre-existing preview data
   */
  getPreviewData(nodeId: number): { imagepreview?: ImagePreviewParams; videopreview?: VideoPreviewParams } | null {
    const nodeValues = this.modifiedWidgetValues.get(nodeId);
    if (!nodeValues) return null;

    return {
      imagepreview: nodeValues.imagepreview?.params,
      videopreview: nodeValues.videopreview?.params
    };
  }

  /**
   * Cleanup event listeners and reset state
   */
  cleanup(): void {
    if (!this.isInitialized) return;

    // Cleanup event listeners using the stored bound handler reference
    if (this.boundHandler) {
      const comfyUIService = ComfyUIService;
      const beforeCount = comfyUIService.getListenerCount('node_execution_complete');
      comfyUIService.off('node_execution_complete', this.boundHandler);
      const afterCount = comfyUIService.getListenerCount('node_execution_complete');
      this.boundHandler = null;
    }
    
    this.currentWorkflow = null;
    this.isInitialized = false;

  }

  /**
   * Destroy singleton instance
   */
  static destroy(): void {
    if (this.instance) {
      this.instance.cleanup();
      this.instance = null;
    }
  }
}

// Export singleton instance
export const nodePreviewManager = NodePreviewManager.getInstance();

// Export types for use in other modules
export type {
  NodeExecutionCompleteData,
  ImagePreviewParams,
  VideoPreviewParams,
  NodePreviewManagerEvents
};