import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { ConnectionConfig } from '@/shared/types/comfy/connection';

export class ConnectionService {
  private api: AxiosInstance | null = null;
  private config: ConnectionConfig = {
    maxRetries: 4,
    retryDelays: [1000, 2000, 4000, 8000],
    timeout: 5000
  };
  
  constructor(baseURL?: string) {
    if (baseURL) {
      this.setBaseURL(baseURL);
    }
  }

  setBaseURL(baseURL: string) {
    this.api = axios.create({
      baseURL: baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async pingServer(timeout?: number): Promise<boolean> {
    if (!this.api) {
      throw new Error('No server URL configured');
    }

    const requestConfig = timeout ? { timeout } : {};

    try {
      // Try /system_stats first (newer versions)
      const response = await this.api.get('/system_stats', requestConfig);
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback to /object_info (works on all versions)
        const response = await this.api.get('/object_info', requestConfig);
        return response.status === 200;
      } catch (fallbackError) {
        if (axios.isAxiosError(fallbackError)) {
          if (fallbackError.code === 'ECONNABORTED') {
            throw new Error('Connection timeout - server may be unreachable');
          } else if (fallbackError.response?.status === 404) {
            throw new Error('Invalid ComfyUI endpoint - please check the URL');
          } else if (fallbackError.message.includes('CORS')) {
            throw new Error('CORS error - ensure ComfyUI is configured to allow cross-origin requests');
          }
        }
        throw new Error('Failed to connect to server');
      }
    }
  }

  async getObjectInfo(): Promise<any> {
    if (!this.api) {
      throw new Error('No server URL configured');
    }

    try {
      const response = await this.api.get('/object_info');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch object info: ${error.message}`);
      }
      throw error;
    }
  }

  async testConnection(timeout?: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.pingServer(timeout);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  getBaseURL(): string | undefined {
    return this.api?.defaults.baseURL;
  }
}

export const connectionService = new ConnectionService();