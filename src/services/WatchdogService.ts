/**
 * External Watchdog Service
 */

export interface WatchdogStatus {
  watchdog: {
    running: boolean;
    restart_count: number;
    last_restart: string | null;
    check_interval: number;
  };
  comfyui: {
    port: number;
    responsive: boolean;
    process_running: boolean;
    process_pid: number | null;
  };
  api: {
    enabled: boolean;
    host: string;
    port: number;
  };
  timestamp: string;
}

export interface WatchdogLog {
  timestamp: string;
  message: string;
}

export interface WatchdogLogsResponse {
  logs: WatchdogLog[];
  total_count: number;
  limit: number;
}

export interface WatchdogRestartResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface WatchdogConfig {
  check_interval?: number;
  max_restart_attempts?: number;
  comfyui_path?: string;
  comfyui_port?: number;
  comfyui_script?: string;
}

export interface WatchdogStartRequest {
  comfyui_path: string;
  comfyui_port: number;
  comfyui_script?: string;
}

export interface WatchdogStartResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export class WatchdogService {
  private apiUrl = 'http://localhost:9188';
  private timeout = 10000; // 10 seconds timeout

  /**
   * Watchdog status retrieval
   */
  async getStatus(): Promise<WatchdogStatus | null> {
    try {
      const response = await fetch(`${this.apiUrl}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error(`❌ Watchdog status error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to get watchdog status:', error);
      return null;
    }
  }

  /**
   * ComfyUI manual restart request
   */
  async restartComfyUI(): Promise<WatchdogRestartResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ ComfyUI restart requested:', result.message);
        return result;
      } else {
        console.error(`❌ Watchdog restart error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to request ComfyUI restart:', error);
      return null;
    }
  }

  /**
   * Recent logs retrieval
   */
  async getRecentLogs(limit: number = 50): Promise<WatchdogLogsResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/logs?limit=${limit}`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error(`❌ Watchdog logs error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to get watchdog logs:', error);
      return null;
    }
  }

  /**
   * Watchdog configuration update
   */
  async updateConfig(config: WatchdogConfig): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Watchdog config updated:', result.message);
        return result.success;
      } else {
        console.error(`❌ Watchdog config error: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to update watchdog config:', error);
      return false;
    }
  }

  /**
   * Check if watchdog is running
   */
  async isWatchdogRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Short timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Watchdog start (with parameters)
   */
  async startWatchdog(config: WatchdogStartRequest): Promise<WatchdogStartResponse | null> {
    try {
      const response = await fetch(`${this.apiUrl}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comfyui_path: config.comfyui_path,
          comfyui_port: config.comfyui_port,
          comfyui_script: config.comfyui_script || 'main.py'
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Watchdog start requested:', result.message);
        return result;
      } else {
        console.error(`❌ Watchdog start error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to start watchdog:', error);
      return null;
    }
  }

  /**
   * Health check (ComfyUI + Watchdog)
   */
  async performHealthCheck(): Promise<{
    watchdog_running: boolean;
    comfyui_responsive: boolean;
    comfyui_process_running: boolean;
    overall_status: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const watchdogRunning = await this.isWatchdogRunning();
    let comfyuiResponsive = false;
    let comfyuiProcessRunning = false;

    if (watchdogRunning) {
      const status = await this.getStatus();
      if (status) {
        comfyuiResponsive = status.comfyui.responsive;
        comfyuiProcessRunning = status.comfyui.process_running;
      }
    } else {
      // If watchdog is not running, directly check ComfyUI
      try {
        const response = await fetch('http://localhost:8188/', {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        comfyuiResponsive = response.ok;
        comfyuiProcessRunning = response.ok; // If response is received, process is running
      } catch (error) {
        comfyuiResponsive = false;
        comfyuiProcessRunning = false;
      }
    }

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (watchdogRunning && comfyuiResponsive) {
      overallStatus = 'healthy';
    } else if (comfyuiResponsive || watchdogRunning) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      watchdog_running: watchdogRunning,
      comfyui_responsive: comfyuiResponsive,
      comfyui_process_running: comfyuiProcessRunning,
      overall_status: overallStatus
    };
  }
}

// Singleton instance creation
export const watchdogService = new WatchdogService();