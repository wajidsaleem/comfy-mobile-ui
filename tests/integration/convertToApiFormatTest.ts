/**
 * Convert to API Format Testing System
 * 
 * Tests the complete workflow pipeline with detailed file outputs:
 * 1. JSON → Graph (save graph.json)
 * 2. Graph → API (save api.json)  
 * 3. Validate API structure
 * 4. Server execution test (optional)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { loadWorkflowToGraph, serializeGraph } from '../../src/core/services/WorkflowGraphService';
import * as ComfyAPI from '../../src/infrastructure/api/ComfyApiFunctions';
import { testConfig, getTestServerUrl, getTestConnectionTimeout } from '../utils/testConfig';

interface TestStep {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
  outputFile?: string;
  data?: any;
}

interface ValidationResult {
  totalNodes: number;
  validNodes: number;
  validationRate: number;
  invalidNodes: string[];
  issues: Array<{
    nodeId: string;
    issue: string;
    severity: 'warning' | 'error';
  }>;
}

class ConvertToApiFormatTester {
  private serverUrl: string;
  private workflowFile: string;
  private outputDir: string;
  private timestamp: string;
  private steps: TestStep[] = [];

  constructor(serverUrl?: string, workflowFile?: string) {
    // Use testConfig server URL if none provided
    this.serverUrl = serverUrl || getTestServerUrl();
    this.workflowFile = workflowFile || '';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.outputDir = path.join(process.cwd(), 'tests', 'output', `convert-to-api-format-test-${this.timestamp}`);
    
    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log('📊', JSON.stringify(data, null, 2));
    }
  }

  private saveToFile(filename: string, data: any): string {
    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  /**
   * Step 1: Load workflow JSON and save original
   */
  async step1_loadWorkflow(): Promise<TestStep> {
    const startTime = Date.now();
    
    try {
      this.log(`📂 Step 1: Loading workflow from ${this.workflowFile}`);
      
      if (!fs.existsSync(this.workflowFile)) {
        throw new Error(`Workflow file not found: ${this.workflowFile}`);
      }
      
      const workflowData = JSON.parse(fs.readFileSync(this.workflowFile, 'utf-8'));
      
      // Save original workflow
      const originalFile = this.saveToFile('01-original-workflow.json', workflowData);
      
      this.log(`✅ Workflow loaded successfully: ${workflowData.nodes?.length || 0} nodes`);
      
      const step: TestStep = {
        name: 'loadWorkflow',
        success: true,
        duration: Date.now() - startTime,
        outputFile: originalFile,
        data: workflowData
      };
      
      this.steps.push(step);
      return step;
      
    } catch (error) {
      const step: TestStep = {
        name: 'loadWorkflow',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 2: Convert JSON to Graph and save
   */
  async step2_convertToGraph(workflowData: any): Promise<TestStep> {
    const startTime = Date.now();
    
    try {
      this.log(`🔄 Step 2: Converting JSON to Graph`);
      
      // Get object info from server using configured timeout
      const timeout = getTestConnectionTimeout();
      const response = await axios.get(`${this.serverUrl}/object_info`, { timeout });
      const objectInfo = response.data;
      
      // Save object_info from server
      const objectInfoFile = this.saveToFile('01b-server-object-info.json', {
        timestamp: new Date().toISOString(),
        serverUrl: this.serverUrl,
        objectInfo: objectInfo
      });
      
      // Convert to graph (disable preprocessing to avoid custom node mapping dependency)
      const graph = await loadWorkflowToGraph(workflowData, objectInfo, true, false);
      
      // Save graph structure
      const graphFile = this.saveToFile('02-graph-structure.json', {
        timestamp: new Date().toISOString(),
        nodes: graph._nodes?.length || 0,
        links: Object.keys(graph._links || {}).length,
        groups: graph._groups?.length || 0,
        graph: graph
      });
      
      // Save serialized workflow (graph back to JSON)
      const serialized = serializeGraph(graph);
      const serializedFile = this.saveToFile('02b-serialized-workflow.json', serialized);
      
      this.log(`✅ Graph conversion successful: ${graph._nodes?.length || 0} nodes, ${Object.keys(graph._links || {}).length} links`);
      
      const step: TestStep = {
        name: 'convertToGraph',
        success: true,
        duration: Date.now() - startTime,
        outputFile: graphFile,
        data: { graph, objectInfo, serialized }
      };
      
      this.steps.push(step);
      return step;
      
    } catch (error) {
      const step: TestStep = {
        name: 'convertToGraph',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 3: Convert Graph to API format and save
   */
  async step3_convertToAPI(graph: any, originalWorkflow: any): Promise<TestStep> {
    const startTime = Date.now();
    
    try {
      this.log(`🔧 Step 3: Converting Graph to API format`);
      
      const result = ComfyAPI.convertGraphToAPI(graph);
      
      // Save API format
      const apiFile = this.saveToFile('03-api-format.json', {
        timestamp: new Date().toISOString(),
        nodeCount: result.nodeCount,
        api: result.apiWorkflow
      });
      
      // Save prompt payload (ComfyUI ready format)
      const promptPayload = {
        client_id: `convert-to-api-format-test-${Date.now()}`,
        prompt: result.apiWorkflow,
        extra_data: {
          extra_pnginfo: {
            workflow: originalWorkflow
          }
        }
      };
      
      const promptFile = this.saveToFile('03b-prompt-payload.json', promptPayload);
      
      this.log(`✅ API conversion successful: ${result.nodeCount} nodes`);
      
      const step: TestStep = {
        name: 'convertToAPI',
        success: true,
        duration: Date.now() - startTime,
        outputFile: apiFile,
        data: { apiWorkflow: result.apiWorkflow, promptPayload }
      };
      
      this.steps.push(step);
      return step;
      
    } catch (error) {
      const step: TestStep = {
        name: 'convertToAPI',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 4: Validate API structure
   */
  async step4_validateAPI(ourAPI: any): Promise<TestStep> {
    const startTime = Date.now();
    
    try {
      this.log(`🔍 Step 4: Validating API structure`);
      
      const validation = this.validateAPIStructure(ourAPI);
      
      // Save validation results
      const validationFile = this.saveToFile('04-validation-results.json', {
        timestamp: new Date().toISOString(),
        validation,
        ourAPI
      });
      
      this.log(`📊 Validation complete: ${validation.validationRate.toFixed(2)}% valid nodes`);
      this.log(`✅ Valid nodes: ${validation.validNodes}/${validation.totalNodes}`);
      
      if (validation.invalidNodes.length > 0) {
        this.log(`❌ Invalid nodes: ${validation.invalidNodes.join(', ')}`);
      }
      
      if (validation.issues.length > 0) {
        this.log(`⚠️ Issues found: ${validation.issues.length}`);
        validation.issues.slice(0, 5).forEach(issue => {
          const emoji = issue.severity === 'error' ? '❌' : '⚠️';
          this.log(`  ${emoji} Node ${issue.nodeId}: ${issue.issue}`);
        });
      }
      
      const step: TestStep = {
        name: 'validateAPI',
        success: true,
        duration: Date.now() - startTime,
        outputFile: validationFile,
        data: validation
      };
      
      this.steps.push(step);
      return step;
      
    } catch (error) {
      const step: TestStep = {
        name: 'validateAPI',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 5: Execute on server using /prompt endpoint
   */
  async step5_executeOnServer(promptPayload: any): Promise<TestStep> {
    const startTime = Date.now();
    
    try {
      this.log(`🚀 Step 5: Executing on ComfyUI server via /prompt`);
      
      // Test server connection first
      this.log(`🔍 Testing server connection to ${this.serverUrl}`);
      const connectionTimeout = getTestConnectionTimeout();
      
      try {
        const connectionTest = await axios.get(`${this.serverUrl}/system_stats`, { 
          timeout: connectionTimeout 
        });
        this.log(`🔗 Server connection successful`);
      } catch (connError) {
        if (axios.isAxiosError(connError)) {
          const status = connError.response?.status;
          const errorData = connError.response?.data;
          
          let errorMessage = `Server connection failed (${status || 'no response'})`;
          
          if (status && errorData) {
            this.log(`🔍 Connection Error Details: ${JSON.stringify(errorData, null, 2)}`);
            errorMessage += `\nServer Response: ${JSON.stringify(errorData)}`;
          }
          
          throw new Error(errorMessage);
        } else {
          throw new Error(`Server connection failed: ${connError}`);
        }
      }
      
      // Send prompt to /prompt endpoint
      this.log(`📤 Sending prompt to ${this.serverUrl}/prompt`);
      let promptResponse;
      let promptResult;
      
      try {
        promptResponse = await axios.post(`${this.serverUrl}/prompt`, promptPayload, {
          timeout: 30000, // 30 second timeout for prompt submission
          headers: {
            'Content-Type': 'application/json'
          }
        });
        promptResult = promptResponse.data;
      } catch (promptError) {
        if (axios.isAxiosError(promptError)) {
          const status = promptError.response?.status;
          const errorData = promptError.response?.data;
          
          let errorMessage = `Prompt submission failed with status: ${status}`;
          
          if (status === 400 && errorData) {
            this.log(`❌ 400 Bad Request - Server Error Details:`);
            
            // Handle ComfyUI specific error format
            if (errorData.error) {
              this.log(`🔍 Error: ${JSON.stringify(errorData.error, null, 2)}`);
              errorMessage += `\nError Details: ${JSON.stringify(errorData.error)}`;
            } else if (typeof errorData === 'string') {
              this.log(`🔍 Error Message: ${errorData}`);
              errorMessage += `\nError Message: ${errorData}`;
            } else {
              this.log(`🔍 Full Error Response: ${JSON.stringify(errorData, null, 2)}`);
              errorMessage += `\nFull Response: ${JSON.stringify(errorData)}`;
            }
          } else if (errorData) {
            this.log(`🔍 Server Response: ${JSON.stringify(errorData, null, 2)}`);
            errorMessage += `\nServer Response: ${JSON.stringify(errorData)}`;
          }
          
          throw new Error(errorMessage);
        } else {
          throw new Error(`Prompt submission failed: ${promptError}`);
        }
      }
      this.log(`✅ Prompt submitted successfully`);
      this.log(`🆔 Prompt ID: ${promptResult.prompt_id}`);
      
      // Wait for execution to complete by polling /history
      this.log(`⏳ Waiting for execution to complete...`);
      const historyResult = await this.waitForCompletion(promptResult.prompt_id);
      
      // Combine results
      const executionResult = {
        promptSubmission: {
          success: true,
          promptId: promptResult.prompt_id,
          response: promptResult
        },
        execution: historyResult
      };
      
      // Save execution results
      const executionFile = this.saveToFile('05-execution-results.json', {
        timestamp: new Date().toISOString(),
        serverUrl: this.serverUrl,
        promptPayload: promptPayload,
        result: executionResult
      });
      
      if (historyResult.success) {
        this.log(`✅ Execution completed successfully`);
        this.log(`⏱️ Execution time: ${historyResult.executionTime}ms`);
        if (historyResult.outputs) {
          this.log(`📊 Generated ${Object.keys(historyResult.outputs).length} outputs`);
        }
      } else {
        this.log(`❌ Execution failed: ${historyResult.error}`);
      }
      
      const step: TestStep = {
        name: 'executeOnServer',
        success: historyResult.success,
        duration: Date.now() - startTime,
        outputFile: executionFile,
        data: executionResult,
        error: historyResult.success ? undefined : historyResult.error
      };
      
      this.steps.push(step);
      return step;
      
    } catch (error) {
      const step: TestStep = {
        name: 'executeOnServer',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.steps.push(step);
      return step;
    }
  }

  /**
   * Wait for prompt execution to complete by polling /history
   */
  private async waitForCompletion(promptId: string, maxWaitTime: number = 60000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 1000; // Poll every 1 second
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        this.log(`🔄 Checking execution status for prompt ${promptId}...`);
        
        const historyResponse = await axios.get(`${this.serverUrl}/history/${promptId}`, {
          timeout: 5000
        });
        
        const historyData = historyResponse.data;
        
        if (historyData && historyData[promptId]) {
          const promptHistory = historyData[promptId];
          
          // Check if execution is complete
          if (promptHistory.status) {
            const status = promptHistory.status;
            
            if (status.completed) {
              this.log(`✅ Execution completed`);
              return {
                success: true,
                promptId: promptId,
                executionTime: Date.now() - startTime,
                status: status,
                outputs: promptHistory.outputs || {},
                history: promptHistory
              };
            } else if (status.status_str === 'error') {
              return {
                success: false,
                promptId: promptId,
                executionTime: Date.now() - startTime,
                error: `Execution failed: ${JSON.stringify(status)}`,
                history: promptHistory
              };
            }
          }
          
          // Still executing, continue polling
          this.log(`⏳ Still executing... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (pollError) {
        this.log(`⚠️ Error polling history: ${pollError}`);
        // Continue polling despite individual request failures
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    // Timeout reached
    return {
      success: false,
      promptId: promptId,
      executionTime: Date.now() - startTime,
      error: `Execution timeout after ${maxWaitTime}ms`
    };
  }

  /**
   * Validate API structure for correctness:
   * - Check that each node has required fields (class_type, inputs)
   * - Validate that inputs are properly structured
   * - Check for common issues that might cause execution failures
   */
  private validateAPIStructure(ourAPI: any): ValidationResult {
    const nodeIds = Object.keys(ourAPI);
    const invalidNodes: string[] = [];
    const issues: Array<{
      nodeId: string;
      issue: string;
      severity: 'warning' | 'error';
    }> = [];
    
    let validNodes = 0;
    
    for (const nodeId of nodeIds) {
      const node = ourAPI[nodeId];
      let nodeIsValid = true;
      
      // Check if node has class_type
      if (!node.class_type) {
        issues.push({
          nodeId,
          issue: 'Missing class_type field',
          severity: 'error'
        });
        nodeIsValid = false;
      }
      
      // Check if node has inputs object
      if (!node.inputs) {
        issues.push({
          nodeId,
          issue: 'Missing inputs field',
          severity: 'warning'
        });
      } else {
        // Validate inputs structure
        for (const [inputName, inputValue] of Object.entries(node.inputs)) {
          // Check for circular references in inputs
          if (Array.isArray(inputValue) && inputValue.length === 2) {
            const [sourceNodeId] = inputValue;
            if (sourceNodeId === nodeId) {
              issues.push({
                nodeId,
                issue: `Self-referencing input: ${inputName}`,
                severity: 'error'
              });
              nodeIsValid = false;
            }
          }
        }
      }
      
      // Check for empty class_type
      if (node.class_type === '') {
        issues.push({
          nodeId,
          issue: 'Empty class_type',
          severity: 'error'
        });
        nodeIsValid = false;
      }
      
      if (nodeIsValid) {
        validNodes++;
      } else {
        invalidNodes.push(nodeId);
      }
    }
    
    const totalNodes = nodeIds.length;
    const validationRate = totalNodes > 0 ? (validNodes / totalNodes) * 100 : 0;
    
    return {
      totalNodes,
      validNodes,
      validationRate,
      invalidNodes,
      issues
    };
  }


  /**
   * Generate final test report
   */
  generateReport(): void {
    const totalDuration = this.steps.reduce((sum, step) => sum + (step.duration || 0), 0);
    const successCount = this.steps.filter(step => step.success).length;
    
    const report = {
      timestamp: new Date().toISOString(),
      workflowFile: this.workflowFile,
      serverUrl: this.serverUrl,
      outputDirectory: this.outputDir,
      summary: {
        totalSteps: this.steps.length,
        successfulSteps: successCount,
        failedSteps: this.steps.length - successCount,
        totalDuration: `${totalDuration}ms`,
        overallSuccess: successCount === this.steps.length
      },
      steps: this.steps
    };
    
    const reportFile = this.saveToFile('00-test-report.json', report);
    
    console.log('\n' + '='.repeat(80));
    console.log(`🎯 CONVERT TO API FORMAT TEST REPORT`);
    console.log('='.repeat(80));
    console.log(`📁 Workflow: ${this.workflowFile}`);
    console.log(`🌐 Server: ${this.serverUrl}`);
    console.log(`📂 Output: ${this.outputDir}`);
    console.log(`⏱️ Duration: ${totalDuration}ms`);
    console.log(`✅ Success: ${successCount}/${this.steps.length} steps`);
    
    this.steps.forEach((step, index) => {
      const emoji = step.success ? '✅' : '❌';
      console.log(`${emoji} Step ${index + 1}: ${step.name} (${step.duration}ms)`);
      if (step.error) {
        console.log(`   Error: ${step.error}`);
      }
      if (step.outputFile) {
        console.log(`   Output: ${path.basename(step.outputFile)}`);
      }
    });
    
    console.log(`📋 Full report: ${reportFile}`);
    console.log('='.repeat(80));
  }

  /**
   * Run complete convert to API format test
   */
  async runCompleteTest(executeOnServer: boolean = false): Promise<void> {
    this.log('🚀 Starting Convert to API Format Test');
    
    try {
      // Step 1: Load workflow
      const step1 = await this.step1_loadWorkflow();
      if (!step1.success) {
        throw new Error(`Step 1 failed: ${step1.error}`);
      }
      
      // Step 2: Convert to Graph
      const step2 = await this.step2_convertToGraph(step1.data);
      if (!step2.success) {
        throw new Error(`Step 2 failed: ${step2.error}`);
      }
      
      // Step 3: Convert Graph to API 
      const step3 = await this.step3_convertToAPI(step2.data?.graph, step1.data);
      if (!step3.success) {
        throw new Error(`Step 3 failed: ${step3.error}`);
      }
      
      // Step 4: Validate API structure
      const step4 = await this.step4_validateAPI(step3.data.apiWorkflow);
      if (!step4.success) {
        this.log(`⚠️ Step 4 (validation) failed, but continuing: ${step4.error}`);
      }
      
      // Step 5: Execute on server (optional)
      if (executeOnServer) {
        this.log('🚀 Executing on server as requested...');
        await this.step5_executeOnServer(step3.data.promptPayload);
      } else {
        this.log('⏭️ Skipping server execution (use --execute flag to enable)');
      }
      
    } catch (error) {
      this.log(`❌ Test pipeline failed: ${error}`);
    } finally {
      this.generateReport();
    }
  }
}

// CLI execution
const main = async () => {
  const args = process.argv.slice(2);
  
  // Require workflow file as first argument
  if (args.length === 0) {
    console.error('❌ Error: Workflow file is required');
    console.error('Usage: npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts <workflow-file> [options]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts tests/samples/workflows/sample-workflow.json');
    console.error('  npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts tests/samples/workflows/sample-workflow.json --execute');
    console.error('');
    console.error('Options:');
    console.error('  --server <url>    ComfyUI server URL (default: from test-config.json)');
    console.error('  --execute         Execute workflow on server (default: false)');
    process.exit(1);
  }
  
  const workflowFile = args[0];
  
  // Load test configuration and print it
  testConfig.printConfig();
  
  // Debug: Print all arguments
  console.log(`🔍 Debug - All arguments: ${JSON.stringify(args)}`);
  
  // Parse additional arguments
  let serverUrl: string | undefined = undefined; // Will use testConfig server URL if not specified
  let executeOnServer = false;
  
  for (let i = 1; i < args.length; i++) {
    console.log(`🔍 Debug - Processing arg[${i}]: ${args[i]}`);
    
    if (args[i] === '--server' && i + 1 < args.length) {
      serverUrl = args[i + 1];
      console.log(`🔍 Debug - Server URL set to: ${serverUrl}`);
      i++; // Skip next argument as it's the server URL
    } else if (args[i] === '--execute') {
      executeOnServer = true;
      console.log(`🔍 Debug - Execute flag detected: ${executeOnServer}`);
    }
  }
  
  // Validate workflow file exists
  if (!fs.existsSync(workflowFile)) {
    console.error(`❌ Error: Workflow file not found: ${workflowFile}`);
    process.exit(1);
  }
  
  console.log(`📁 Workflow: ${workflowFile}`);
  console.log(`🚀 Execute on server: ${executeOnServer ? 'Yes' : 'No'}`);
  console.log(`🔍 Debug - Final executeOnServer value: ${executeOnServer}`);
  console.log('🚀 Starting convert to API format test...\n');
  
  const tester = new ConvertToApiFormatTester(serverUrl, workflowFile);
  await tester.runCompleteTest(executeOnServer);
};

// Always run main when this file is executed
main().catch(console.error);

export { ConvertToApiFormatTester };