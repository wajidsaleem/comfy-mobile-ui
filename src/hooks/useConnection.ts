import { useEffect } from 'react';
import { useConnectionStore } from '@/ui/store/connectionStore';

export const useConnection = () => {
  const {
    url,
    isConnected,
    isConnecting,
    error,
    lastPingTime,
    connect,
    disconnect,
    retryConnection,
    autoReconnectEnabled,
    webSocket,
    connectWebSocket,
    disconnectWebSocket,
    initializeWebSocketListeners
  } = useConnectionStore();

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isConnected) {
      intervalId = setInterval(async () => {
        try {
          await connect();
        } catch {
          if (autoReconnectEnabled) {
            retryConnection();
          }
        }
      }, 30000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, connect, retryConnection, autoReconnectEnabled]);

  // Initialize WebSocket listeners on mount
  useEffect(() => {
    const cleanup = initializeWebSocketListeners();
    return cleanup;
  }, [initializeWebSocketListeners]);

  // Auto-connect on mount if URL is available
  useEffect(() => {
    if (url && !isConnected && !isConnecting && autoReconnectEnabled) {
      connect();
    }
  }, []);

  return {
    url,
    isConnected,
    isConnecting,
    error,
    lastPingTime,
    connect,
    disconnect,
    // WebSocket-specific exports
    webSocket,
    connectWebSocket,
    disconnectWebSocket
  };
};