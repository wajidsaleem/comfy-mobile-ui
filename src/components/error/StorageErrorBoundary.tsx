/**
 * Storage Error Boundary
 * 
 * Catches React errors that might be caused by storage corruption
 * and provides recovery options to the user.
 */

import React from 'react';
import { toast } from 'sonner';
import { performSelectiveStorageCleanup } from '@/utils/storageRecovery';

interface StorageErrorBoundaryState {
  hasError: boolean;
  errorInfo?: string;
  isRecovering: boolean;
}

interface StorageErrorBoundaryProps {
  children: React.ReactNode;
}

class StorageErrorBoundary extends React.Component<
  StorageErrorBoundaryProps,
  StorageErrorBoundaryState
> {
  constructor(props: StorageErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): StorageErrorBoundaryState {
    // Check if this looks like a storage-related error
    const storageRelatedKeywords = [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'quota',
      'storage',
      'persist',
      'zustand'
    ];
    
    const isStorageError = storageRelatedKeywords.some(keyword =>
      error.message.toLowerCase().includes(keyword) ||
      error.stack?.toLowerCase().includes(keyword)
    );

    return {
      hasError: true,
      errorInfo: isStorageError 
        ? 'This appears to be a storage-related error that might be fixed by clearing corrupted data.'
        : 'An unexpected error occurred. This might be related to corrupted browser data.',
      isRecovering: false
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💥 StorageErrorBoundary caught an error:', error, errorInfo);
  }

  handleRecovery = async () => {
    this.setState({ isRecovering: true });
    
    try {
      toast.loading('🔧 Attempting automatic recovery...', {
        description: 'Preserving your workflow data while fixing the app.',
        duration: 2000
      });

      const result = await performSelectiveStorageCleanup();
      
      if (result.success) {
        toast.success('✅ Recovery completed!', {
          description: 'The app will refresh automatically.',
          duration: 2000
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      } else {
        toast.error('❌ Automatic recovery failed', {
          description: result.errorMessage || 'Please try manual recovery options.',
          duration: 5000
        });
        this.setState({ isRecovering: false });
      }
    } catch (error) {
      console.error('Recovery failed:', error);
      toast.error('❌ Recovery failed', {
        description: 'Please refresh the page or clear browser data manually.',
        duration: 5000
      });
      this.setState({ isRecovering: false });
    }
  };

  handleManualRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="pwa-container bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 text-center space-y-4">
            
            {this.state.isRecovering ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
                <h2 className="text-xl font-semibold text-white">🔧 Recovering...</h2>
                <p className="text-gray-300">Attempting to fix the issue while preserving your data.</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-white">App Error Detected</h2>
                <p className="text-gray-300 text-sm">
                  {this.state.errorInfo}
                </p>
                
                <div className="space-y-2 pt-4">
                  <button
                    onClick={this.handleRecovery}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                    disabled={this.state.isRecovering}
                  >
                    🔧 Try Automatic Recovery
                  </button>
                  
                  <button
                    onClick={this.handleManualRefresh}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors"
                    disabled={this.state.isRecovering}
                  >
                    🔄 Refresh Page
                  </button>
                  
                  <div className="text-xs text-gray-400 pt-2">
                    <p>💡 Automatic recovery preserves your workflow data.</p>
                    <p>If that fails, try refreshing or clearing browser data.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StorageErrorBoundary;