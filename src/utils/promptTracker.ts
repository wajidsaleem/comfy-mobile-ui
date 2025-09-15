// Utility for tracking running prompts with localStorage persistence
// Survives browser close/reopen for better user experience

interface RunningPrompt {
  promptId: string;
  workflowId: string;
  workflowName?: string;
  timestamp: number;
  status: 'running' | 'pending';
}

const STORAGE_KEY = 'comfy_running_prompts';

export class PromptTracker {
  // Add a prompt to tracking when it starts running
  static addRunningPrompt(promptId: string, workflowId: string, workflowName?: string): void {
    console.log(`🎯 [PromptTracker] Adding running prompt to localStorage:`, {
      promptId: promptId.substring(0, 8) + '...',
      workflowId,
      workflowName
    });

    const runningPrompts = this.getRunningPrompts();
    console.log(`🎯 [PromptTracker] Current tracked prompts:`, runningPrompts.length);
    
    // Remove existing entry for same workflow if any
    const filtered = runningPrompts.filter(p => p.workflowId !== workflowId);
    if (filtered.length < runningPrompts.length) {
      console.log(`🎯 [PromptTracker] Removed existing entry for workflow ${workflowId}`);
    }
    
    // Add new entry
    const newEntry = {
      promptId,
      workflowId,
      workflowName,
      timestamp: Date.now(),
      status: 'running' as const
    };
    filtered.push(newEntry);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log(`🎯 [PromptTracker] Successfully stored prompt tracking data. Total entries:`, filtered.length);
  }

  // Get all currently tracked running prompts
  static getRunningPrompts(): RunningPrompt[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to parse running prompts from localStorage:', error);
      return [];
    }
  }

  // Check if a workflow has a running prompt
  static getRunningPromptForWorkflow(workflowId: string): RunningPrompt | null {
    console.log(`🔍 [PromptTracker] Checking for running prompt for workflow: ${workflowId}`);
    const runningPrompts = this.getRunningPrompts();
    console.log(`🔍 [PromptTracker] Available tracked prompts:`, runningPrompts.map(p => ({
      promptId: p.promptId.substring(0, 8) + '...',
      workflowId: p.workflowId,
      age: Math.floor((Date.now() - p.timestamp) / 1000) + 's'
    })));
    
    const found = runningPrompts.find(p => p.workflowId === workflowId) || null;
    
    if (found) {
      console.log(`✅ [PromptTracker] Found running prompt for workflow ${workflowId}:`, {
        promptId: found.promptId.substring(0, 8) + '...',
        age: Math.floor((Date.now() - found.timestamp) / 1000) + 's'
      });
    } else {
      console.log(`❌ [PromptTracker] No running prompt found for workflow ${workflowId}`);
    }
    
    return found;
  }

  // Remove a prompt from tracking (when it completes/errors)
  static removePrompt(promptId: string): void {
    console.log(`🗑️ [PromptTracker] Removing completed/failed prompt:`, promptId.substring(0, 8) + '...');
    const runningPrompts = this.getRunningPrompts();
    const filtered = runningPrompts.filter(p => p.promptId !== promptId);
    
    if (filtered.length < runningPrompts.length) {
      console.log(`✅ [PromptTracker] Successfully removed prompt. Remaining entries:`, filtered.length);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } else {
      console.log(`⚠️ [PromptTracker] Prompt not found in tracking data`);
    }
  }

  // Clean up old entries (older than 24 hours)
  static cleanupOldEntries(): void {
    const runningPrompts = this.getRunningPrompts();
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const filtered = runningPrompts.filter(p => p.timestamp > oneDayAgo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  // Sync with actual queue status - remove completed prompts
  static syncWithQueueStatus(queueData: any[]): void {
    console.log(`🔄 [PromptTracker] Syncing with queue status. Queue items:`, queueData.length);
    
    const runningPrompts = this.getRunningPrompts();
    const activePromptIds = new Set();
    
    // Extract all prompt IDs from current queue
    queueData.forEach(item => {
      if (item[1] && typeof item[1] === 'string') {
        activePromptIds.add(item[1]); // prompt_id is at index 1
        console.log(`🔄 [PromptTracker] Active queue prompt:`, item[1].substring(0, 8) + '...');
      }
    });

    console.log(`🔄 [PromptTracker] Found ${activePromptIds.size} active prompts in queue`);
    console.log(`🔄 [PromptTracker] Currently tracking ${runningPrompts.length} prompts`);

    // Remove prompts that are no longer in queue
    const stillRunning = runningPrompts.filter(p => activePromptIds.has(p.promptId));
    
    const removedCount = runningPrompts.length - stillRunning.length;
    if (removedCount > 0) {
      console.log(`🧹 [PromptTracker] Cleaned up ${removedCount} completed prompts from tracking`);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stillRunning));
    } else {
      console.log(`✅ [PromptTracker] All tracked prompts are still active`);
    }
  }

  // Clear all tracked prompts (for debugging/reset)
  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}