/**
 * Test Configuration Utilities
 * 
 * Manages test environment settings including server connection details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestServerConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

export interface TestTimeouts {
  connection: number;
  execution: number;
}

export interface TestConfig {
  server: TestServerConfig;
  timeouts: TestTimeouts;
  environment: string;
  description?: string;
  notes?: string[];
}

class TestConfigManager {
  private static instance: TestConfigManager;
  private config: TestConfig | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(__dirname, '..', 'test-config.json');
  }

  public static getInstance(): TestConfigManager {
    if (!TestConfigManager.instance) {
      TestConfigManager.instance = new TestConfigManager();
    }
    return TestConfigManager.instance;
  }

  /**
   * Load configuration from file
   */
  public loadConfig(): TestConfig {
    if (this.config) {
      return this.config;
    }

    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Test configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData) as TestConfig;

      // Validate required fields
      this.validateConfig(parsedConfig);

      this.config = parsedConfig;
      return this.config;
    } catch (error) {
      console.error('❌ Failed to load test configuration:', error);
      
      // Return default configuration as fallback
      console.warn('⚠️ Using default test configuration');
      const defaultConfig: TestConfig = {
        server: {
          host: 'localhost',
          port: 8000,
          protocol: 'http'
        },
        timeouts: {
          connection: 5000,
          execution: 30000
        },
        environment: 'default'
      };
      
      this.config = defaultConfig;
      return this.config;
    }
  }

  /**
   * Get server URL from configuration
   */
  public getServerUrl(): string {
    const config = this.loadConfig();
    return `${config.server.protocol}://${config.server.host}:${config.server.port}`;
  }

  /**
   * Get connection timeout
   */
  public getConnectionTimeout(): number {
    const config = this.loadConfig();
    return config.timeouts.connection;
  }

  /**
   * Get execution timeout
   */
  public getExecutionTimeout(): number {
    const config = this.loadConfig();
    return config.timeouts.execution;
  }

  /**
   * Override server configuration (useful for CLI arguments)
   */
  public overrideServerConfig(host?: string, port?: number, protocol?: 'http' | 'https'): void {
    const config = this.loadConfig();
    
    if (host) config.server.host = host;
    if (port) config.server.port = port;
    if (protocol) config.server.protocol = protocol;
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: any): void {
    const requiredFields = [
      'server',
      'server.host',
      'server.port',
      'server.protocol',
      'timeouts',
      'timeouts.connection',
      'timeouts.execution'
    ];

    for (const field of requiredFields) {
      const keys = field.split('.');
      let current = config;
      
      for (const key of keys) {
        if (current[key] === undefined) {
          throw new Error(`Missing required configuration field: ${field}`);
        }
        current = current[key];
      }
    }

    // Validate protocol
    if (!['http', 'https'].includes(config.server.protocol)) {
      throw new Error(`Invalid protocol: ${config.server.protocol}. Must be 'http' or 'https'`);
    }

    // Validate port range
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error(`Invalid port: ${config.server.port}. Must be between 1 and 65535`);
    }
  }

  /**
   * Print current configuration (useful for debugging)
   */
  public printConfig(): void {
    const config = this.loadConfig();
    console.log('📋 Test Configuration:');
    console.log(`   Server: ${this.getServerUrl()}`);
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Connection Timeout: ${config.timeouts.connection}ms`);
    console.log(`   Execution Timeout: ${config.timeouts.execution}ms`);
  }
}

// Export singleton instance
export const testConfig = TestConfigManager.getInstance();

// Export utility functions
export const getTestServerUrl = (): string => testConfig.getServerUrl();
export const getTestConnectionTimeout = (): number => testConfig.getConnectionTimeout();
export const getTestExecutionTimeout = (): number => testConfig.getExecutionTimeout();