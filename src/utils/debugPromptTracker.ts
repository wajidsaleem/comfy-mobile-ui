// Debug utility to inspect localStorage prompt tracking data
// Temporary file for debugging - can be removed after issue is resolved

export const debugPromptTracker = () => {
  const STORAGE_KEY = 'comfy_running_prompts';
  
  console.log('🔍 [DEBUG] === Prompt Tracker Debug Information ===');
  
  // Check localStorage contents
  const stored = localStorage.getItem(STORAGE_KEY);
  console.log('🔍 [DEBUG] Raw localStorage data:', stored);
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('🔍 [DEBUG] Parsed localStorage data:', parsed);
      console.log('🔍 [DEBUG] Number of tracked prompts:', parsed.length);
      
      parsed.forEach((prompt: any, index: number) => {
        console.log(`🔍 [DEBUG] Prompt ${index + 1}:`, {
          promptId: prompt.promptId?.substring(0, 8) + '...',
          workflowId: prompt.workflowId,
          workflowName: prompt.workflowName,
          age: Math.floor((Date.now() - prompt.timestamp) / 1000) + 's',
          status: prompt.status
        });
      });
    } catch (error) {
      console.error('🔍 [DEBUG] Failed to parse localStorage data:', error);
    }
  } else {
    console.log('🔍 [DEBUG] No data found in localStorage');
  }
  
  // Check current workflow context
  console.log('🔍 [DEBUG] Current page URL:', window.location.href);
  console.log('🔍 [DEBUG] Current workflow ID from URL:', window.location.pathname.split('/').pop());
  
  console.log('🔍 [DEBUG] === End Debug Information ===');
};

// Auto-run on import during development
if (typeof window !== 'undefined') {
  debugPromptTracker();
}