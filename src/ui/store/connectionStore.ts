import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ConnectionState } from '@/shared/types/comfy/connection';
import { connectionService } from '@/infrastructure/api/ConnectionService';
import { globalWebSocketService, type GlobalWebSocketState } from '@/infrastructure/websocket/GlobalWebSocketService';

interface ConnectionStore extends ConnectionState {
  setUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  setError: (error: string | null) => void;
  retryConnection: () => Promise<void>;
  autoReconnectEnabled: boolean;
  setAutoReconnect: (enabled: boolean) => void;
  tryAutoConnect: () => Promise<void>;
  checkExtension: () => Promise<void>;
  
  // WebSocket-specific state and actions
  webSocket: GlobalWebSocketState;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  initializeWebSocketListeners: () => void;
}

const STORAGE_KEY = 'comfy-mobile-connection';

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    persist(
      (set, get) => ({
        url: '',
        isConnected: false,
        isConnecting: false,
        lastPingTime: null,
        error: null,
        hasExtension: false,
        isCheckingExtension: false,
        autoReconnectEnabled: true,
        
        // Initialize WebSocket state
        webSocket: globalWebSocketService.getState(),

        setUrl: (url: string) => {
          set({ url, error: null });
        },

        connect: async () => {
          const { url, isConnecting } = get();
          
          if (!url || isConnecting) return;

          set({ isConnecting: true, error: null });

          try {
            connectionService.setBaseURL(url);
            const result = await connectionService.testConnection();
            
            if (result.success) {
              set({ 
                isConnected: true, 
                isConnecting: false,
                lastPingTime: Date.now(),
                error: null 
              });
              
              // Auto-connect WebSocket when HTTP connection succeeds
              get().connectWebSocket();
              
              // Check extension availability
              get().checkExtension();
            } else {
              set({ 
                isConnected: false, 
                isConnecting: false,
                error: result.error || 'Connection failed' 
              });
            }
          } catch (error) {
            set({ 
              isConnected: false, 
              isConnecting: false,
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        },

        disconnect: () => {
          // Disconnect both HTTP and WebSocket
          get().disconnectWebSocket();
          set({ 
            isConnected: false, 
            lastPingTime: null,
            error: null,
            hasExtension: false,
            isCheckingExtension: false
          });
        },

        setError: (error: string | null) => {
          set({ error });
        },

        retryConnection: async () => {
          const { autoReconnectEnabled } = get();
          if (!autoReconnectEnabled) return;

          const delays = [1000, 2000, 4000, 8000];
          
          for (let i = 0; i < delays.length; i++) {
            await new Promise(resolve => setTimeout(resolve, delays[i]));
            
            const { isConnected } = get();
            if (isConnected) return;

            await get().connect();
            
            const { isConnected: connected } = get();
            if (connected) return;
          }
        },

        setAutoReconnect: (enabled: boolean) => {
          set({ autoReconnectEnabled: enabled });
        },

        tryAutoConnect: async () => {
          const { url, isConnected, isConnecting } = get();
          
          // Skip if already connected, connecting, or no URL saved
          if (isConnected || isConnecting || !url.trim()) {
            return;
          }

          
          // Use a shorter timeout for auto-connect to avoid blocking UI
          set({ isConnecting: true, error: null });

          try {
            connectionService.setBaseURL(url);
            // Use shorter timeout for auto-connection (3 seconds)
            const result = await connectionService.testConnection(3000);
            
            if (result.success) {
              set({ 
                isConnected: true, 
                isConnecting: false,
                lastPingTime: Date.now(),
                error: null 
              });
              
              // Auto-connect WebSocket when HTTP auto-connection succeeds
              get().connectWebSocket();
              
              // Check extension availability
              get().checkExtension();
            } else {
              set({ 
                isConnected: false, 
                isConnecting: false,
                error: null // Don't show error for auto-connect failures
              });
            }
          } catch (error) {
            set({ 
              isConnected: false, 
              isConnecting: false,
              error: null // Don't show error for auto-connect failures
            });
          }
        },

        checkExtension: async () => {
          const { url, isConnected } = get();
          
          if (!url || !isConnected) {
            set({ hasExtension: false, isCheckingExtension: false });
            return;
          }

          set({ isCheckingExtension: true });

          try {
            const response = await fetch(`${url}/comfymobile/api/status`, {
              method: 'GET',
              signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
              const data = await response.json();
              const extensionAvailable = data.status === 'ok' && data.extension === 'ComfyUI Mobile UI API';
              
              set({ 
                hasExtension: extensionAvailable,
                isCheckingExtension: false 
              });
              
              console.log(extensionAvailable ? 
                '✅ Extension API is available' : 
                '⚠️ Extension API responded but status not valid'
              );
            } else {
              set({ 
                hasExtension: false,
                isCheckingExtension: false 
              });
              console.log('⚠️ Extension API response not ok:', response.status);
            }
          } catch (error) {
            set({ 
              hasExtension: false,
              isCheckingExtension: false 
            });
            console.log('⚠️ Extension API check failed:', error);
          }
        },

        // WebSocket-specific actions
        connectWebSocket: () => {
          const { url } = get();
          if (!url) return;
          
          globalWebSocketService.setServerUrl(url);
          globalWebSocketService.connect();
        },

        disconnectWebSocket: () => {
          globalWebSocketService.disconnect();
        },

        initializeWebSocketListeners: () => {
          // Update store when WebSocket state changes
          const handleStateChange = (wsState: GlobalWebSocketState) => {
            set({ webSocket: wsState });
          };

          const handleConnected = (data: any) => {
          };

          const handleDisconnected = (data: any) => {
          };

          const handleError = (data: any) => {
            console.error('❌ Global WebSocket error:', data.type, data.error);
          };

          // Subscribe to WebSocket events
          globalWebSocketService.on('stateChange', handleStateChange);
          globalWebSocketService.on('connected', handleConnected);
          globalWebSocketService.on('disconnected', handleDisconnected);
          globalWebSocketService.on('error', handleError);

          // Return cleanup function
          return () => {
            globalWebSocketService.off('stateChange', handleStateChange);
            globalWebSocketService.off('connected', handleConnected);
            globalWebSocketService.off('disconnected', handleDisconnected);
            globalWebSocketService.off('error', handleError);
          };
        }
      }),
      {
        name: STORAGE_KEY,
        partialize: (state) => ({ 
          url: state.url,
          autoReconnectEnabled: state.autoReconnectEnabled 
        }),
      }
    )
  )
);