/**
 * Workflow Refresh Testing System
 *
 * Tests the workflow refresh functionality to ensure that refreshing node slots
 * doesn't break complex workflows. Compares workflow before and after refresh
 * to detect structural changes.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { loadWorkflowToGraph, serializeGraph, createInputSlots, createOutputSlots } from '../../src/core/services/WorkflowGraphService';
import { testConfig, getTestServerUrl, getTestConnectionTimeout } from '../utils/testConfig';

interface RefreshTestStep {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
  outputFile?: string;
  data?: any;
}

interface RefreshValidationResult {
  isIdentical: boolean;
  nodeCountBefore: number;
  nodeCountAfter: number;
  linkCountBefore: number;
  linkCountAfter: number;
  differences: Array<{
    type: 'node' | 'link' | 'slot';
    nodeId?: number;
    slotName?: string;
    difference: string;
    severity: 'warning' | 'error';
  }>;
}

class WorkflowRefreshTester {
  private serverUrl: string;
  private workflowFile: string;
  private outputDir: string;
  private timestamp: string;
  private steps: RefreshTestStep[] = [];

  constructor(serverUrl?: string, workflowFile?: string) {
    this.serverUrl = serverUrl || getTestServerUrl();
    this.workflowFile = workflowFile || '';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.outputDir = path.join(process.cwd(), 'tests', 'output', `workflow-refresh-test-${this.timestamp}`);

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
   * Step 1: Load original workflow
   */
  async step1_loadOriginalWorkflow(): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`📂 Step 1: Loading original workflow from ${this.workflowFile}`);

      if (!fs.existsSync(this.workflowFile)) {
        throw new Error(`Workflow file not found: ${this.workflowFile}`);
      }

      const workflowData = JSON.parse(fs.readFileSync(this.workflowFile, 'utf-8'));

      const originalFile = this.saveToFile('01-original-workflow.json', workflowData);

      this.log(`✅ Original workflow loaded: ${workflowData.nodes?.length || 0} nodes`);

      const step: RefreshTestStep = {
        name: 'loadOriginalWorkflow',
        success: true,
        duration: Date.now() - startTime,
        outputFile: originalFile,
        data: workflowData
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'loadOriginalWorkflow',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 2: Get server object_info for refresh simulation
   */
  async step2_getObjectInfo(): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`🔄 Step 2: Getting object_info from server`);

      const timeout = getTestConnectionTimeout();
      const response = await axios.get(`${this.serverUrl}/object_info`, { timeout });
      const objectInfo = response.data;

      const objectInfoFile = this.saveToFile('02-server-object-info.json', {
        timestamp: new Date().toISOString(),
        serverUrl: this.serverUrl,
        objectInfo: objectInfo
      });

      this.log(`✅ Object info retrieved: ${Object.keys(objectInfo).length} node types`);

      const step: RefreshTestStep = {
        name: 'getObjectInfo',
        success: true,
        duration: Date.now() - startTime,
        outputFile: objectInfoFile,
        data: objectInfo
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'getObjectInfo',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 3: Convert workflow to graph (before refresh)
   */
  async step3_convertToGraphBefore(workflowData: any, objectInfo: any): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`🔧 Step 3: Converting workflow to graph (before refresh)`);

      const graph = await loadWorkflowToGraph(workflowData, objectInfo, true, false);

      const graphFile = this.saveToFile('03-graph-before-refresh.json', {
        timestamp: new Date().toISOString(),
        nodes: graph._nodes?.length || 0,
        links: Object.keys(graph._links || {}).length,
        groups: graph._groups?.length || 0,
        graph: graph
      });

      this.log(`✅ Graph created (before): ${graph._nodes?.length || 0} nodes, ${Object.keys(graph._links || {}).length} links`);

      const step: RefreshTestStep = {
        name: 'convertToGraphBefore',
        success: true,
        duration: Date.now() - startTime,
        outputFile: graphFile,
        data: graph
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'convertToGraphBefore',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 4: Simulate refresh process (similar to refreshNodeSlots function)
   */
  async step4_simulateRefresh(originalGraph: any, objectInfo: any): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`🔄 Step 4: Simulating refresh process`);

      // Deep clone the graph to avoid modifying the original
      const refreshedGraph = JSON.parse(JSON.stringify(originalGraph));

      if (!refreshedGraph._nodes || !Array.isArray(refreshedGraph._nodes)) {
        throw new Error('Graph has no nodes to refresh');
      }

      let refreshedCount = 0;
      let skippedCount = 0;
      const refreshLog: any[] = [];

      // Process each node like refreshNodeSlots does
      for (const node of refreshedGraph._nodes) {
        const nodeId = node.id;
        const nodeType = node.type;

        if (!nodeType) {
          skippedCount++;
          refreshLog.push({
            nodeId,
            status: 'skipped',
            reason: 'No node type'
          });
          continue;
        }

        const nodeMetadata = objectInfo[nodeType];
        if (!nodeMetadata) {
          skippedCount++;
          refreshLog.push({
            nodeId,
            status: 'skipped',
            reason: `Node type "${nodeType}" not found on server`
          });
          continue;
        }

        // Get existing slots
        const existingInputs = node.inputs || [];
        const existingOutputs = node.outputs || [];

        // Create fresh template slots from metadata
        const templateInputs = createInputSlots(nodeMetadata.input || {}, nodeMetadata.input_order);
        const templateOutputs = createOutputSlots(
          nodeMetadata.output || [],
          nodeMetadata.output_name || []
        );

        // Merge like refreshNodeSlots does - preserve existing slots and add new template slots
        const existingInputsByName = new Map(existingInputs.map((slot: any) => [slot.name, slot]));
        const existingOutputsByName = new Map(existingOutputs.map((slot: any) => [slot.name, slot]));

        // Start with existing inputs and add new template inputs
        const mergedInputs = [...existingInputs];
        for (const templateSlot of templateInputs) {
          if (!existingInputsByName.has(templateSlot.name)) {
            // Add new slot from template if it doesn't exist
            mergedInputs.push(templateSlot);
          }
        }

        // Start with existing outputs and add new template outputs
        const mergedOutputs = [...existingOutputs];
        for (const templateSlot of templateOutputs) {
          if (!existingOutputsByName.has(templateSlot.name)) {
            // Add new slot from template if it doesn't exist
            mergedOutputs.push(templateSlot);
          }
        }

        // Update node slots
        node.inputs = mergedInputs;
        node.outputs = mergedOutputs;

        refreshedCount++;
        refreshLog.push({
          nodeId,
          status: 'refreshed',
          inputsBefore: existingInputs.length,
          inputsAfter: mergedInputs.length,
          outputsBefore: existingOutputs.length,
          outputsAfter: mergedOutputs.length
        });
      }

      const refreshResultFile = this.saveToFile('04-refresh-simulation-log.json', {
        timestamp: new Date().toISOString(),
        refreshedCount,
        skippedCount,
        refreshLog
      });

      const refreshedGraphFile = this.saveToFile('04-graph-after-refresh.json', {
        timestamp: new Date().toISOString(),
        nodes: refreshedGraph._nodes?.length || 0,
        links: Object.keys(refreshedGraph._links || {}).length,
        groups: refreshedGraph._groups?.length || 0,
        graph: refreshedGraph
      });

      this.log(`✅ Refresh simulation complete: ${refreshedCount} nodes refreshed, ${skippedCount} skipped`);

      const step: RefreshTestStep = {
        name: 'simulateRefresh',
        success: true,
        duration: Date.now() - startTime,
        outputFile: refreshedGraphFile,
        data: {
          refreshedGraph,
          refreshedCount,
          skippedCount,
          refreshLog
        }
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'simulateRefresh',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 5: Create workflow JSONs from refreshed data for comparison
   */
  async step5_createWorkflowJsons(originalWorkflow: any, refreshedGraph: any): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`📝 Step 5: Creating workflow JSONs for comparison`);

      // Use original workflow as base
      const originalForComparison = originalWorkflow;
      const originalFile = this.saveToFile('05-original-for-comparison.json', originalForComparison);

      // Create refreshed workflow by updating nodes from refreshed graph
      const refreshedWorkflow = {
        ...originalWorkflow,
        nodes: refreshedGraph._nodes?.map((node: any) => ({
          id: node.id,
          type: node.type,
          pos: node.pos || [0, 0],
          size: node.size || [140, 26],
          flags: node.flags || {},
          order: node.order || 0,
          mode: node.mode || 0,
          inputs: node.inputs || [],
          outputs: node.outputs || [],
          properties: node.properties || {},
          widgets_values: node.widgets_values || []
        })) || []
      };

      const refreshedFile = this.saveToFile('05-refreshed-workflow.json', refreshedWorkflow);

      this.log(`✅ Both workflows created successfully`);
      this.log(`   Original: ${originalForComparison.nodes?.length || 0} nodes`);
      this.log(`   Refreshed: ${refreshedWorkflow.nodes?.length || 0} nodes`);

      const step: RefreshTestStep = {
        name: 'createWorkflowJsons',
        success: true,
        duration: Date.now() - startTime,
        outputFile: refreshedFile,
        data: {
          originalWorkflow: originalForComparison,
          refreshedWorkflow
        }
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'createWorkflowJsons',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }

  /**
   * Step 6: Compare workflows and validate consistency
   */
  async step6_compareWorkflows(originalSerialized: any, refreshedSerialized: any): Promise<RefreshTestStep> {
    const startTime = Date.now();

    try {
      this.log(`🔍 Step 6: Comparing workflows for consistency`);

      const validation = this.validateWorkflowConsistency(originalSerialized, refreshedSerialized);

      const validationFile = this.saveToFile('06-comparison-results.json', {
        timestamp: new Date().toISOString(),
        validation,
        originalWorkflow: originalSerialized,
        refreshedWorkflow: refreshedSerialized
      });

      this.log(`📊 Comparison complete:`);
      this.log(`   Workflows identical: ${validation.isIdentical ? 'YES' : 'NO'}`);
      this.log(`   Node count before: ${validation.nodeCountBefore}`);
      this.log(`   Node count after: ${validation.nodeCountAfter}`);
      this.log(`   Link count before: ${validation.linkCountBefore}`);
      this.log(`   Link count after: ${validation.linkCountAfter}`);
      this.log(`   Differences found: ${validation.differences.length}`);

      if (validation.differences.length > 0) {
        this.log(`⚠️ Issues found:`);
        validation.differences.slice(0, 5).forEach(diff => {
          const emoji = diff.severity === 'error' ? '❌' : '⚠️';
          this.log(`  ${emoji} ${diff.type}: ${diff.difference}`);
        });
        if (validation.differences.length > 5) {
          this.log(`  ... and ${validation.differences.length - 5} more`);
        }
      }

      const step: RefreshTestStep = {
        name: 'compareWorkflows',
        success: true,
        duration: Date.now() - startTime,
        outputFile: validationFile,
        data: validation
      };

      this.steps.push(step);
      return step;

    } catch (error) {
      const step: RefreshTestStep = {
        name: 'compareWorkflows',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.steps.push(step);
      return step;
    }
  }


  /**
   * Compare two workflows and find differences
   */
  private validateWorkflowConsistency(original: any, refreshed: any): RefreshValidationResult {
    const differences: Array<{
      type: 'node' | 'link' | 'slot';
      nodeId?: number;
      slotName?: string;
      difference: string;
      severity: 'warning' | 'error';
    }> = [];

    const originalNodes = original.nodes || [];
    const refreshedNodes = refreshed.nodes || [];
    const originalLinks = original.links || [];
    const refreshedLinks = refreshed.links || [];

    // Compare node counts
    if (originalNodes.length !== refreshedNodes.length) {
      differences.push({
        type: 'node',
        difference: `Node count changed: ${originalNodes.length} → ${refreshedNodes.length}`,
        severity: 'error'
      });
    }

    // Compare link counts
    if (originalLinks.length !== refreshedLinks.length) {
      differences.push({
        type: 'link',
        difference: `Link count changed: ${originalLinks.length} → ${refreshedLinks.length}`,
        severity: 'error'
      });
    }

    // Create maps for easier comparison
    const originalNodeMap = new Map(originalNodes.map((n: any) => [n.id, n]));
    const refreshedNodeMap = new Map(refreshedNodes.map((n: any) => [n.id, n]));

    // Compare each node
    for (const [nodeId, originalNode] of originalNodeMap) {
      const refreshedNode = refreshedNodeMap.get(nodeId);

      if (!refreshedNode) {
        differences.push({
          type: 'node',
          nodeId,
          difference: `Node ${nodeId} was removed during refresh`,
          severity: 'error'
        });
        continue;
      }

      // Compare basic node properties
      if (originalNode.type !== refreshedNode.type) {
        differences.push({
          type: 'node',
          nodeId,
          difference: `Node ${nodeId} type changed: ${originalNode.type} → ${refreshedNode.type}`,
          severity: 'error'
        });
      }

      // Compare input slots
      const originalInputs = originalNode.inputs || [];
      const refreshedInputs = refreshedNode.inputs || [];

      if (originalInputs.length !== refreshedInputs.length) {
        differences.push({
          type: 'slot',
          nodeId,
          difference: `Node ${nodeId} input count changed: ${originalInputs.length} → ${refreshedInputs.length}`,
          severity: 'warning'
        });
      }

      // Compare output slots
      const originalOutputs = originalNode.outputs || [];
      const refreshedOutputs = refreshedNode.outputs || [];

      if (originalOutputs.length !== refreshedOutputs.length) {
        differences.push({
          type: 'slot',
          nodeId,
          difference: `Node ${nodeId} output count changed: ${originalOutputs.length} → ${refreshedOutputs.length}`,
          severity: 'warning'
        });
      }

      // Compare slot names
      for (let i = 0; i < Math.max(originalInputs.length, refreshedInputs.length); i++) {
        const origInput = originalInputs[i];
        const refInput = refreshedInputs[i];

        if (origInput && refInput && origInput.name !== refInput.name) {
          differences.push({
            type: 'slot',
            nodeId,
            slotName: origInput.name,
            difference: `Node ${nodeId} input slot ${i} name changed: ${origInput.name} → ${refInput.name}`,
            severity: 'warning'
          });
        }
      }

      for (let i = 0; i < Math.max(originalOutputs.length, refreshedOutputs.length); i++) {
        const origOutput = originalOutputs[i];
        const refOutput = refreshedOutputs[i];

        if (origOutput && refOutput && origOutput.name !== refOutput.name) {
          differences.push({
            type: 'slot',
            nodeId,
            slotName: origOutput.name,
            difference: `Node ${nodeId} output slot ${i} name changed: ${origOutput.name} → ${refOutput.name}`,
            severity: 'warning'
          });
        }
      }
    }

    // Check for new nodes
    for (const [nodeId, refreshedNode] of refreshedNodeMap) {
      if (!originalNodeMap.has(nodeId)) {
        differences.push({
          type: 'node',
          nodeId,
          difference: `Node ${nodeId} was added during refresh`,
          severity: 'error'
        });
      }
    }

    return {
      isIdentical: differences.length === 0,
      nodeCountBefore: originalNodes.length,
      nodeCountAfter: refreshedNodes.length,
      linkCountBefore: originalLinks.length,
      linkCountAfter: refreshedLinks.length,
      differences
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
    console.log(`🎯 WORKFLOW REFRESH TEST REPORT`);
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
   * Run complete workflow refresh test
   */
  async runCompleteTest(): Promise<void> {
    this.log('🚀 Starting Workflow Refresh Test');

    try {
      // Step 1: Load original workflow
      const step1 = await this.step1_loadOriginalWorkflow();
      if (!step1.success) {
        throw new Error(`Step 1 failed: ${step1.error}`);
      }

      // Step 2: Get object info
      const step2 = await this.step2_getObjectInfo();
      if (!step2.success) {
        throw new Error(`Step 2 failed: ${step2.error}`);
      }

      // Step 3: Convert to graph (before refresh)
      const step3 = await this.step3_convertToGraphBefore(step1.data, step2.data);
      if (!step3.success) {
        throw new Error(`Step 3 failed: ${step3.error}`);
      }

      // Step 4: Simulate refresh
      const step4 = await this.step4_simulateRefresh(step3.data, step2.data);
      if (!step4.success) {
        throw new Error(`Step 4 failed: ${step4.error}`);
      }

      // Step 5: Create workflow JSONs
      const step5 = await this.step5_createWorkflowJsons(step1.data, step4.data.refreshedGraph);
      if (!step5.success) {
        throw new Error(`Step 5 failed: ${step5.error}`);
      }

      // Step 6: Compare workflows
      const step6 = await this.step6_compareWorkflows(
        step5.data.originalWorkflow,
        step5.data.refreshedWorkflow
      );
      if (!step6.success) {
        this.log(`⚠️ Step 6 (comparison) failed: ${step6.error}`);
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
    console.error('Usage: npx tsx --tsconfig tsx.config.json tests/integration/workflowRefreshTest.ts <workflow-file> [options]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx --tsconfig tsx.config.json tests/integration/workflowRefreshTest.ts tests/samples/workflows/sample-workflow.json');
    console.error('  npx tsx --tsconfig tsx.config.json tests/integration/workflowRefreshTest.ts tests/samples/workflows/sample-workflow.json --server http://localhost:8188');
    console.error('');
    console.error('Options:');
    console.error('  --server <url>    ComfyUI server URL (default: from test-config.json)');
    process.exit(1);
  }

  const workflowFile = args[0];

  // Load test configuration and print it
  testConfig.printConfig();

  // Parse additional arguments
  let serverUrl: string | undefined = undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--server' && i + 1 < args.length) {
      serverUrl = args[i + 1];
      i++; // Skip next argument as it's the server URL
    }
  }

  // Validate workflow file exists
  if (!fs.existsSync(workflowFile)) {
    console.error(`❌ Error: Workflow file not found: ${workflowFile}`);
    process.exit(1);
  }

  console.log(`📁 Workflow: ${workflowFile}`);
  console.log('🚀 Starting workflow refresh test...\n');

  const tester = new WorkflowRefreshTester(serverUrl, workflowFile);
  await tester.runCompleteTest();
};

// Always run main when this file is executed
main().catch(console.error);

export { WorkflowRefreshTester };