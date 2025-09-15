/**
 * Storage Recovery Utilities
 * 
 * Handles automatic recovery from corrupted localStorage/sessionStorage 
 * while preserving IndexedDB workflow data.
 */

import { toast } from 'sonner';

interface StorageRecoveryResult {
  success: boolean;
  recoveredWorkflows: number;
  errorMessage?: string;
  backupCreated: boolean;
}

/**
 * Checks if there are signs of storage corruption that might prevent app initialization
 */
export const detectStorageCorruption = (): boolean => {
  try {
    // Try to access critical localStorage keys that Zustand uses
    const connectionData = localStorage.getItem('comfy-mobile-connection');
    
    // If we can't even access localStorage, it's definitely corrupted
    if (connectionData !== null) {
      // Try to parse it to see if it's valid JSON
      JSON.parse(connectionData);
    }
    
    // Check if we can write to localStorage
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    
    return false; // No corruption detected
  } catch (error) {
    console.warn('🚨 Storage corruption detected:', error);
    return true;
  }
};

/**
 * Creates a backup of IndexedDB workflow data in localStorage
 * (using a different key that won't interfere with app state)
 */
export const backupIndexedDBWorkflows = async (): Promise<number> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('ComfyMobileUI', 1);
      
      request.onerror = () => {
        console.warn('⚠️ Could not access IndexedDB for backup');
        resolve(0);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains('workflows')) {
          console.warn('⚠️ No workflows store found in IndexedDB');
          resolve(0);
          return;
        }
        
        const transaction = db.transaction(['workflows'], 'readonly');
        const store = transaction.objectStore('workflows');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          const workflows = getAllRequest.result;
          
          if (workflows.length > 0) {
            // Store backup with timestamp to avoid conflicts
            const backupKey = `__workflow_backup_${Date.now()}__`;
            try {
              localStorage.setItem(backupKey, JSON.stringify(workflows));
              console.log(`💾 Created backup with ${workflows.length} workflows`);
            } catch (error) {
              console.warn('⚠️ Could not create localStorage backup:', error);
            }
          }
          
          resolve(workflows.length);
        };
        
        getAllRequest.onerror = () => {
          console.warn('⚠️ Could not retrieve workflows for backup');
          resolve(0);
        };
      };
    } catch (error) {
      console.warn('⚠️ Error during IndexedDB backup:', error);
      resolve(0);
    }
  });
};

/**
 * Performs selective localStorage cleanup while preserving IndexedDB data
 */
export const performSelectiveStorageCleanup = async (): Promise<StorageRecoveryResult> => {
  try {
    console.log('🔧 Starting selective storage recovery...');
    
    // Step 1: Backup IndexedDB data first
    const workflowCount = await backupIndexedDBWorkflows();
    
    // Step 2: Identify and remove problematic localStorage keys
    const problematicKeys = [
      'comfy-mobile-connection',        // Zustand connectionStore state
      'comfyui_workflows',             // Legacy localStorage workflow data  
      'comfyui_seed_controls',         // Seed control settings
    ];
    
    let removedKeys = 0;
    problematicKeys.forEach(key => {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removedKeys++;
          console.log(`❌ Removed corrupted key: ${key}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not remove key ${key}:`, error);
      }
    });
    
    // Step 3: Clear sessionStorage (it's safe and will be rebuilt)
    try {
      sessionStorage.clear();
      console.log('🧹 Cleared sessionStorage');
    } catch (error) {
      console.warn('⚠️ Could not clear sessionStorage:', error);
    }
    
    // Step 4: Verify IndexedDB is still intact
    const verifyWorkflows = await new Promise<number>((resolve) => {
      try {
        const request = indexedDB.open('ComfyMobileUI', 1);
        
        request.onsuccess = () => {
          const db = request.result;
          
          if (!db.objectStoreNames.contains('workflows')) {
            resolve(0);
            return;
          }
          
          const transaction = db.transaction(['workflows'], 'readonly');
          const store = transaction.objectStore('workflows');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            resolve(countRequest.result);
          };
          
          countRequest.onerror = () => {
            resolve(0);
          };
        };
        
        request.onerror = () => {
          resolve(0);
        };
      } catch (error) {
        resolve(0);
      }
    });
    
    console.log('✅ Storage recovery completed');
    console.log(`💾 IndexedDB workflows preserved: ${verifyWorkflows}`);
    
    return {
      success: true,
      recoveredWorkflows: verifyWorkflows,
      backupCreated: workflowCount > 0
    };
    
  } catch (error) {
    console.error('❌ Storage recovery failed:', error);
    return {
      success: false,
      recoveredWorkflows: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      backupCreated: false
    };
  }
};

/**
 * Shows recovery toast notifications to the user
 */
export const showRecoveryToast = (result: StorageRecoveryResult) => {
  if (result.success) {
    toast.success(`🔧 App storage recovered successfully!`, {
      description: result.recoveredWorkflows > 0 
        ? `${result.recoveredWorkflows} workflows have been safely preserved.`
        : 'App has been successfully reinitialized.',
      duration: 5000,
      action: {
        label: 'OK',
        onClick: () => {}
      }
    });
  } else {
    toast.error(`❌ Automatic recovery failed`, {
      description: result.errorMessage || 'Please manually clear your browser data.',
      duration: 8000,
      action: {
        label: 'Help',
        onClick: () => {
          // Could open help modal or navigate to troubleshooting page
          console.log('User requested recovery help');
        }
      }
    });
  }
};

/**
 * Main recovery function to be called during app initialization
 */
export const autoRecoverIfNeeded = async (): Promise<boolean> => {
  // Only attempt recovery if corruption is detected
  if (!detectStorageCorruption()) {
    return false; // No recovery needed
  }
  
  console.log('🚨 Storage corruption detected, attempting automatic recovery...');
  
  toast.loading('🔧 Automatically recovering storage issues...', {
    description: 'Workflow data will be safely preserved.',
    duration: 2000
  });
  
  const result = await performSelectiveStorageCleanup();
  showRecoveryToast(result);
  
  return result.success;
};