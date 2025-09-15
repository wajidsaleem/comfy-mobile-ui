/**
 * Node Patch Component
 * 
 * Workflow -> Node -> Input Field Widget Type Mapping
 * Allows users to configure multiple input fields for a selected node with appropriate widget types
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, FileText, Layers, ChevronRight, Save, RefreshCw, Plus, X, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { loadAllWorkflows } from '@/infrastructure/storage/IndexedDBWorkflowService';
import { useWidgetTypes } from '@/core/services/WidgetTypeManager';
import { Workflow } from '@/shared/types/app/IComfyWorkflow';
import { WidgetTypeDefinition } from '@/shared/types/app/WidgetFieldTypes';
import ComfyApiClient from '@/infrastructure/api/ComfyApiClient';
import { cleanupSingleNodeCustomFields } from '@/core/services/WorkflowJsonPreprocessor';

interface NodeInfo {
  id: string;
  type: string;
  title?: string;
  inputs: Array<{
    name: string;
    type: string;
    link?: number;
    widget?: {
      name: string;
      [key: string]: any;
    };
  }>;
  _meta?: {
    title?: string;
  };
}

interface InputFieldMapping {
  fieldName: string;
  fieldType: string;
  currentValue: any;
  assignedWidgetType?: string;
  isCustomField?: boolean; // Flag to indicate if this is a user-added field
  hasWidget?: boolean; // Flag to indicate if this input has widget capability
}

export const NodePatch: React.FC = () => {
  const navigate = useNavigate();
  const { widgetTypes, loading: widgetTypesLoading } = useWidgetTypes();
  
  // View state - either list view or create new mapping workflow
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list');
  
  // Step state for create workflow
  const [currentStep, setCurrentStep] = useState<'workflow' | 'node' | 'mapping'>('workflow');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
  const [inputMappings, setInputMappings] = useState<InputFieldMapping[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Existing mappings state
  const [existingMappings, setExistingMappings] = useState<any[]>([]);
  const [loadingExistingMappings, setLoadingExistingMappings] = useState(true);
  
  // New field creation state
  const [isAddingNewField, setIsAddingNewField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldWidgetType, setNewFieldWidgetType] = useState('');
  
  // Node search and filtering state
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  
  // Scope selection state
  const [selectedScope, setSelectedScope] = useState<'global' | 'workflow' | 'specific'>('global');

  // Load workflows on mount
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setWorkflowsLoading(true);
        const stored = await loadAllWorkflows();
        setWorkflows(stored);
        console.log('📦 Loaded workflows for NodeInputMapping:', stored.length);
      } catch (error) {
        console.error('Failed to load workflows:', error);
        toast.error('Failed to load workflows');
      } finally {
        setWorkflowsLoading(false);
      }
    };

    loadWorkflows();
  }, []);

  // Load existing mappings function
  const loadExistingMappings = async () => {
    try {
      setLoadingExistingMappings(true);
      const mappings = await ComfyApiClient.getCustomNodeMappings();
      setExistingMappings(mappings);
      console.log('📦 Loaded existing mappings:', mappings);
    } catch (error) {
      console.error('Failed to load existing mappings:', error);
      setExistingMappings([]);
    } finally {
      setLoadingExistingMappings(false);
    }
  };

  // Load existing mappings on mount
  useEffect(() => {
    loadExistingMappings();
  }, []);

  // Function to start a fresh workflow creation process
  const handleCreateNew = () => {
    // Reset all workflow creation states
    setCurrentView('create');
    setCurrentStep('workflow');
    setSelectedWorkflow(null);
    setSelectedNode(null);
    setInputMappings([]);
    setIsAddingNewField(false);
    setNewFieldName('');
    setNewFieldWidgetType('');
    setNodeSearchQuery('');
    setSelectedScope('global');
  };

  const handleWorkflowSelect = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setSelectedNode(null); // Reset node selection when workflow changes
    setInputMappings([]); // Reset mappings when workflow changes
    setCurrentStep('node');
  };

  const handleNodeSelect = (nodeId: string, nodeData: any) => {
    // Clean up any existing custom fields from the node data before processing
    // This ensures we always start with the original node structure, not one that has been modified by previous patches
    const cleanedNodeData = cleanupSingleNodeCustomFields(nodeData);
    
    const nodeInfo: NodeInfo = {
      id: nodeId,
      type: cleanedNodeData.type,
      inputs: cleanedNodeData.inputs || [],
      _meta: cleanedNodeData._meta
    };
    
    setSelectedNode(nodeInfo);
    
    // Analyze inputs and create mappings - show all inputs (now cleaned)
    const mappings: InputFieldMapping[] = nodeInfo.inputs.map((input) => ({
      fieldName: input.name,
      fieldType: input.type, // Use the actual ComfyUI type (MODEL, CLIP, etc.)
      currentValue: input.link ? `Connected to node via link ${input.link}` : 'Available for widget input',
      assignedWidgetType: undefined,
      isCustomField: false, // These are original node inputs (cleaned)
      hasWidget: !!input.widget // Track if this input has widget capability
    }));
    
    setInputMappings(mappings);
    setCurrentStep('mapping');
  };

  const handleWidgetTypeAssignment = (fieldName: string, widgetTypeId: string) => {
    setInputMappings(prev => 
      prev.map(mapping => 
        mapping.fieldName === fieldName 
          ? { ...mapping, assignedWidgetType: widgetTypeId === 'none' ? undefined : widgetTypeId }
          : mapping
      )
    );
  };

  const handleAddNewField = () => {
    if (!newFieldName.trim()) {
      toast.error('Please enter a field name');
      return;
    }

    if (!newFieldWidgetType) {
      toast.error('Please select a widget type');
      return;
    }

    // Check if field name already exists
    if (inputMappings.some(mapping => mapping.fieldName === newFieldName.trim())) {
      toast.error('Field name already exists');
      return;
    }

    const newMapping: InputFieldMapping = {
      fieldName: newFieldName.trim(),
      fieldType: newFieldWidgetType, // Use the selected widget type as the field type
      currentValue: 'Will use widget type default',
      assignedWidgetType: newFieldWidgetType,
      isCustomField: true,
      hasWidget: true // Custom fields are always widget-capable
    };

    setInputMappings(prev => [...prev, newMapping]);
    
    // Reset form
    setNewFieldName('');
    setNewFieldWidgetType('');
    setIsAddingNewField(false);
    
    toast.success(`Added new input field: ${newMapping.fieldName} with widget type ${newFieldWidgetType}`);
  };

  const handleRemoveCustomField = (fieldName: string) => {
    setInputMappings(prev => prev.filter(mapping => mapping.fieldName !== fieldName));
    toast.success(`Removed custom field: ${fieldName}`);
  };

  const handleCancelAddField = () => {
    setNewFieldName('');
    setNewFieldWidgetType('');
    setIsAddingNewField(false);
  };

  // Create Power Lora Loader example patch
  const handleCreatePowerLoraExample = async () => {
    try {
      setSaving(true);
      
      // Create 15 LORA_CONFIG custom fields
      const customFields = Array.from({ length: 15 }, (_, index) => ({
        fieldName: `lora_${index + 1}`,
        fieldType: 'LORA_CONFIG',
        assignedWidgetType: 'LORA_CONFIG',
        defaultValue: null
      }));

      const bindingData = {
        nodeType: 'Power Lora Loader (rgthree)',
        inputMappings: {},
        customFields,
        scope: {
          type: 'global'
        },
        createdAt: new Date().toISOString()
      };

      // Save via ComfyApiClient
      await ComfyApiClient.saveCustomNodeMapping(bindingData);
      
      toast.success('Power Lora Loader example created successfully');
      
      // Reload existing mappings
      loadExistingMappings();
      
    } catch (error) {
      console.error('Failed to create Power Lora Loader example:', error);
      toast.error(`Failed to create example: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete specific mapping by scope
  const handleDeleteMapping = async (nodeType: string, scope: any) => {
    const scopeDescription = scope.type === 'global' 
      ? 'Global' 
      : scope.type === 'workflow' 
        ? `Workflow: ${scope.workflowName || scope.workflowId}` 
        : `Specific Node: ${scope.nodeId} in ${scope.workflowName || scope.workflowId}`;
    
    if (!confirm(`Are you sure you want to delete the mapping for "${nodeType}" (${scopeDescription})?`)) {
      return;
    }

    try {
      await ComfyApiClient.deleteCustomNodeMapping(nodeType, scope);
      toast.success(`Deleted mapping for "${nodeType}" (${scopeDescription})`);
      // Refresh the existing mappings list
      loadExistingMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Failed to delete mapping');
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedNode) return;
    
    setSaving(true);
    try {
      // Create binding data for server with scope information
      const bindingData = {
        nodeType: selectedNode.type,
        inputMappings: inputMappings
          .filter(m => m.assignedWidgetType && !m.isCustomField)
          .reduce((acc, mapping) => {
            if (mapping.assignedWidgetType) {
              acc[mapping.fieldName] = mapping.assignedWidgetType;
            }
            return acc;
          }, {} as Record<string, string>),
        customFields: inputMappings
          .filter(m => m.isCustomField)
          .map(mapping => ({
            fieldName: mapping.fieldName,
            fieldType: mapping.assignedWidgetType || 'STRING',
            assignedWidgetType: mapping.assignedWidgetType,
            defaultValue: null
          })),
        scope: {
          type: selectedScope,
          workflowId: selectedScope !== 'global' ? selectedWorkflow?.id : undefined,
          workflowName: selectedScope !== 'global' ? selectedWorkflow?.name : undefined,
          nodeId: selectedScope === 'specific' ? selectedNode.id : undefined
        },
        createdAt: new Date().toISOString()
      };
      
      // Save via ComfyApiClient
      const result = await ComfyApiClient.saveCustomNodeMapping(bindingData);
      
      toast.success(`Saved input mappings for ${selectedNode.type}`);
      
      // Reload existing mappings and return to list view
      const mappings = await ComfyApiClient.getCustomNodeMappings();
      setExistingMappings(mappings);
      
      // Reset all states when returning to list
      setCurrentView('list');
      setCurrentStep('workflow');
      setSelectedWorkflow(null);
      setSelectedNode(null);
      setInputMappings([]);
      setIsAddingNewField(false);
      setNewFieldName('');
      setNewFieldWidgetType('');
      setNodeSearchQuery('');
      setSelectedScope('global');
      
    } catch (error) {
      console.error('Failed to save patches:', error);
      toast.error(`Failed to save patches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const renderWorkflowStep = () => {
    if (workflowsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (!workflows || workflows.length === 0) {
      return (
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <FileText className="h-12 w-12 text-slate-400 mx-auto" />
              <div className="text-slate-600 dark:text-slate-400">No workflows available</div>
              <div className="text-sm text-slate-500 dark:text-slate-500">
                Upload some workflows first to configure node inputs
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <div 
            key={workflow.id} 
            className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg hover:shadow-xl hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 cursor-pointer group"
            onClick={() => handleWorkflowSelect(workflow)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {workflow.name}
                </h3>
                <Badge className="text-xs shrink-0 ml-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
                  {workflow.nodeCount} nodes
                </Badge>
              </div>
              {workflow.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-2">
                  {workflow.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderNodeStep = () => {
    if (!selectedWorkflow?.workflow_json?.nodes) {
      return <div className="text-center py-8">No workflow data available</div>;
    }

    const nodes = selectedWorkflow.workflow_json.nodes || {};
    
    // Create flat list of all nodes with search and sort
    const allNodes = Object.values(nodes).map((nodeData: any) => ({
      ...nodeData,
      id: nodeData.id?.toString(), // use nodeData.id directly
      displayName: nodeData.title || nodeData.type,
      searchText: `${nodeData.title || ''} ${nodeData.type} ${nodeData.id}`.toLowerCase()
    }));
    
    // Filter nodes based on search query
    const filteredNodes = allNodes.filter((node: any) => 
      nodeSearchQuery.trim() === '' || 
      node.searchText.includes(nodeSearchQuery.toLowerCase().trim())
    );
    
    // Sort nodes by display name (ascending)
    const sortedNodes = filteredNodes.sort((a: any, b: any) => 
      a.displayName.localeCompare(b.displayName)
    );
    
    // Group sorted and filtered nodes by type
    const nodesByType = sortedNodes.reduce((acc: any, node: any) => {
      const nodeType = node.type;
      if (!acc[nodeType]) {
        acc[nodeType] = [];
      }
      acc[nodeType].push(node);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <div className="space-y-6">
        {/* Search Field */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <Input
              type="text"
              placeholder="Search nodes by name, type, or ID..."
              value={nodeSearchQuery}
              onChange={(e) => setNodeSearchQuery(e.target.value)}
              className="flex-1 border-0 bg-transparent focus:ring-0 text-slate-700 dark:text-slate-300 placeholder-slate-500 dark:placeholder-slate-400"
            />
            {nodeSearchQuery && (
              <Button
                onClick={() => setNodeSearchQuery('')}
                size="sm"
                className="h-8 w-8 p-0 bg-slate-200/60 dark:bg-slate-700/60 backdrop-blur-sm hover:bg-slate-300/80 dark:hover:bg-slate-600/80 text-slate-600 dark:text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Results Summary */}
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {nodeSearchQuery ? (
              <>Showing {sortedNodes.length} of {allNodes.length} nodes</>
            ) : (
              <>Total {allNodes.length} nodes (sorted by name)</>
            )}
          </div>
        </div>
        
        {/* Node Groups */}
        {Object.keys(nodesByType).length === 0 ? (
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg p-8">
            <div className="text-center">
              <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">No nodes found</p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Try adjusting your search terms
              </p>
            </div>
          </div>
        ) : (
          Object.entries(nodesByType).map(([nodeType, nodeList]) => (
            <div key={nodeType} className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
                  {nodeType}
                </h3>
                <Badge className="text-xs bg-slate-500/80 dark:bg-slate-600/80 backdrop-blur-sm text-white border-slate-400/50 dark:border-slate-500/50">
                  {(nodeList as any[]).length} node{(nodeList as any[]).length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(nodeList as any[]).map((node: any) => (
                  <div 
                    key={node.id}
                    className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg hover:shadow-xl hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 cursor-pointer group"
                    onClick={() => handleNodeSelect(node.id, node)}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {node.displayName}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            ID: {node.id} • Type: {node.type}
                          </div>
                        </div>
                        <Badge className="text-xs bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
                          {(node.inputs || []).length} inputs
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderMappingStep = () => {
    if (!selectedNode) return null;

    return (
      <div className="space-y-6">
        {/* Node Info */}
        <div className="bg-blue-100/60 dark:bg-blue-950/40 backdrop-blur-md border border-blue-200/50 dark:border-blue-800/50 rounded-xl shadow-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Settings className="h-5 w-5" />
              {selectedNode.type}
            </h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Node ID: {selectedNode.id} • {inputMappings.length} input fields to configure
            </p>
          </div>
        </div>

        {/* Input Field Mappings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
              Input Field Mappings
            </h3>
            <Button
              onClick={() => setIsAddingNewField(true)}
              size="sm"
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isAddingNewField}
            >
              <Plus className="h-4 w-4" />
              Add New Field
            </Button>
          </div>
          
          {/* Add New Field Form */}
          {isAddingNewField && (
            <div className="p-4 bg-green-100/60 dark:bg-green-950/40 backdrop-blur-md border border-green-200/50 dark:border-green-800/50 rounded-xl shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-green-700 dark:text-green-300">Add New Input Field</h4>
                  <Button
                    onClick={handleCancelAddField}
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-field-name">Field Name</Label>
                    <Input
                      id="new-field-name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Enter field name..."
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-field-widget-type">Widget Type</Label>
                    <Select value={newFieldWidgetType} onValueChange={setNewFieldWidgetType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select widget type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {widgetTypes?.filter(wt => wt.id && wt.id.trim() !== '').map((widgetType) => (
                          <SelectItem key={widgetType.id} value={widgetType.id}>
                            {widgetType.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button onClick={handleCancelAddField} size="sm" className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
                    Cancel
                  </Button>
                  <Button onClick={handleAddNewField} size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white backdrop-blur-sm">
                    Add Field
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {inputMappings.map((mapping) => (
            <div key={mapping.fieldName} className={`p-4 rounded-xl shadow-lg backdrop-blur-md border transition-all duration-300 ${mapping.isCustomField ? 'bg-blue-100/60 dark:bg-blue-950/40 border-blue-200/50 dark:border-blue-800/50' : 'bg-white/70 dark:bg-slate-900/70 border-white/20 dark:border-slate-700/30'}`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {mapping.fieldName}
                    </div>
                    {mapping.isCustomField && (
                      <Badge className="text-xs bg-blue-500/80 dark:bg-blue-600/80 backdrop-blur-sm text-white border-blue-400/50 dark:border-blue-500/50">
                        Custom
                      </Badge>
                    )}
                    {mapping.isCustomField && (
                      <Button
                        onClick={() => handleRemoveCustomField(mapping.fieldName)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Type: {mapping.fieldType}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    Current: {JSON.stringify(mapping.currentValue)}
                  </div>
                </div>
                
                <div className="flex-1">
                  {mapping.hasWidget ? (
                    <Select
                      value={mapping.assignedWidgetType || 'none'}
                      onValueChange={(value) => handleWidgetTypeAssignment(mapping.fieldName, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select widget type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No widget type</SelectItem>
                        {widgetTypes?.filter(wt => wt.id && wt.id.trim() !== '').map((widgetType) => (
                          <SelectItem key={widgetType.id} value={widgetType.id}>
                            {widgetType.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center justify-center py-2 px-3 rounded-md border border-slate-200/50 dark:border-slate-700/50 bg-slate-100/60 dark:bg-slate-800/60 backdrop-blur-sm">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        No widget capability
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  {mapping.assignedWidgetType && (
                    <Badge className="text-xs bg-green-500/80 dark:bg-green-600/80 backdrop-blur-sm text-white border-green-400/50 dark:border-green-500/50">Assigned</Badge>
                  )}
                  {mapping.isCustomField && (
                    <Button
                      onClick={() => handleRemoveCustomField(mapping.fieldName)}
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Scope Selection and Save Button - Fixed at bottom */}
        <div className="mt-8 pt-6 border-t border-slate-200/30 dark:border-slate-700/30 space-y-6">
          {/* Scope Selection */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-4">
              Patch Application Scope
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedScope('global')}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  selectedScope === 'global'
                    ? 'bg-violet-100/80 dark:bg-violet-950/40 border-violet-300/50 dark:border-violet-700/50 ring-2 ring-violet-500/30'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                  Global
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Apply to all workflows with this node type
                </div>
              </button>
              
              <button
                onClick={() => setSelectedScope('workflow')}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  selectedScope === 'workflow'
                    ? 'bg-violet-100/80 dark:bg-violet-950/40 border-violet-300/50 dark:border-violet-700/50 ring-2 ring-violet-500/30'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                  Workflow
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Apply only to selected workflow
                </div>
              </button>
              
              <button
                onClick={() => setSelectedScope('specific')}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  selectedScope === 'specific'
                    ? 'bg-violet-100/80 dark:bg-violet-950/40 border-violet-300/50 dark:border-violet-700/50 ring-2 ring-violet-500/30'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                  Specific Node
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Apply to specific node ID only
                </div>
              </button>
            </div>
            
            {/* Show selected scope details */}
            <div className="mt-4 p-3 bg-blue-100/60 dark:bg-blue-950/40 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Selected:</strong> {selectedScope === 'global' && 'Global - All workflows with node type "' + selectedNode?.type + '"'}
                {selectedScope === 'workflow' && 'Workflow - Only "' + selectedWorkflow?.name + '"'}
                {selectedScope === 'specific' && 'Specific Node - Node ID "' + selectedNode?.id + '" in "' + selectedWorkflow?.name + '"'}
              </div>
            </div>
          </div>
          
          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveMapping}
              disabled={saving || !inputMappings.some(m => m.assignedWidgetType)}
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 text-lg font-medium"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderExistingMappingsList = () => {
    if (loadingExistingMappings) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (existingMappings.length === 0) {
      return (
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Settings className="h-12 w-12 text-slate-400 mx-auto" />
              <div className="text-slate-600 dark:text-slate-400">No custom node mappings found</div>
              <div className="text-sm text-slate-500 dark:text-slate-500">
                Create your first node patch to get started
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCreateNew} className="gap-2 mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white backdrop-blur-sm">
                  <Plus className="h-4 w-4" />
                  Create New Patch
                </Button>
                <Button 
                  onClick={handleCreatePowerLoraExample} 
                  disabled={saving}
                  className="gap-2 mt-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <Layers className="h-4 w-4" />
                  Power Lora Example
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            Custom Node Patches ({existingMappings.length})
          </h3>
          <Button onClick={handleCreateNew} className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white backdrop-blur-sm">
            <Plus className="h-4 w-4" />
            Add New Patch
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {existingMappings.map((mapping, index) => (
            <div key={index} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/20 dark:border-slate-700/30 rounded-xl shadow-lg hover:shadow-xl hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {mapping.nodeType}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-xs bg-violet-500/80 dark:bg-violet-600/80 backdrop-blur-sm border-violet-400/50 dark:border-violet-500/50 text-white">
                        {Object.keys(mapping.inputMappings || {}).length + (mapping.customFields?.length || 0)} fields
                      </Badge>
                      {/* Scope Badge */}
                      {mapping.scope && (
                        <Badge className={`text-xs backdrop-blur-sm ${
                          mapping.scope.type === 'global'
                            ? 'bg-green-500/80 dark:bg-green-600/80 border-green-400/50 dark:border-green-500/50 text-white'
                            : mapping.scope.type === 'workflow'
                              ? 'bg-blue-500/80 dark:bg-blue-600/80 border-blue-400/50 dark:border-blue-500/50 text-white'
                              : 'bg-orange-500/80 dark:bg-orange-600/80 border-orange-400/50 dark:border-orange-500/50 text-white'
                        }`}>
                          {mapping.scope.type === 'global' 
                            ? 'Global' 
                            : mapping.scope.type === 'workflow' 
                              ? 'Workflow' 
                              : 'Specific'}
                        </Badge>
                      )}
                    </div>
                    {/* Scope Details */}
                    {mapping.scope && mapping.scope.type !== 'global' && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {mapping.scope.type === 'workflow' && (
                          <>Workflow: {mapping.scope.workflowName || mapping.scope.workflowId}</>
                        )}
                        {mapping.scope.type === 'specific' && (
                          <>Node: {mapping.scope.nodeId} in {mapping.scope.workflowName || mapping.scope.workflowId}</>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleDeleteMapping(mapping.nodeType, mapping.scope)}
                    size="sm"
                    className="bg-red-50/60 dark:bg-red-900/30 backdrop-blur-sm hover:bg-red-100/80 dark:hover:bg-red-900/50 border border-red-200/50 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Created: {new Date(mapping.createdAt).toLocaleDateString()}
                </p>
                <div className="space-y-3">
                  {/* Input Mappings */}
                  {mapping.inputMappings && Object.keys(mapping.inputMappings).length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Input Mappings:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(mapping.inputMappings).map(([fieldName, widgetType]) => (
                          <Badge key={fieldName} className="text-xs bg-slate-500/80 dark:bg-slate-600/80 backdrop-blur-sm border-slate-400/50 dark:border-slate-500/50 text-white">
                            {fieldName} → {widgetType as string}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Custom Fields */}
                  {mapping.customFields && mapping.customFields.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Custom Fields:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {mapping.customFields.map((field: any, fieldIndex: number) => (
                          <Badge key={fieldIndex} className="text-xs bg-blue-500/80 dark:bg-blue-600/80 backdrop-blur-sm text-white border-blue-400/50 dark:border-blue-500/50">
                            {field.fieldName} ({field.assignedWidgetType})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'workflow': return 'Select Workflow';
      case 'node': return 'Select Node';
      case 'mapping': return 'Configure Input Fields';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {currentView === 'list' ? (
        // List View - Show existing mappings
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Node Patches
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage custom node patches for ComfyUI nodes
              </p>
            </div>
          </div>
          {renderExistingMappingsList()}
        </>
      ) : (
        // Create View - Original workflow
        <div className="pwa-container bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/20 dark:border-slate-700/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    onClick={() => setCurrentView('list')}
                    className="gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                      Create Node Patch
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Configure widget types for node input fields
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

      {/* Step Progress - Clickable Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-8">
          {/* Workflow Step - Always clickable */}
          <button
            onClick={() => {
              setCurrentStep('workflow');
              setSelectedWorkflow(null);
              setSelectedNode(null);
              setInputMappings([]);
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all duration-200 hover:scale-105 ${
              currentStep === 'workflow' 
                ? 'bg-blue-500/80 dark:bg-blue-600/80 text-white backdrop-blur-sm border border-blue-400/50 dark:border-blue-500/50' 
                : 'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current text-white text-xs flex items-center justify-center">1</span>
            Workflow
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          
          {/* Node Step - Clickable only if current step is 'mapping' */}
          <button
            onClick={() => {
              if (currentStep === 'mapping') {
                setCurrentStep('node');
                setSelectedNode(null);
                setInputMappings([]);
              }
            }}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
              currentStep === 'node'
                ? 'bg-blue-500/80 dark:bg-blue-600/80 text-white backdrop-blur-sm border border-blue-400/50 dark:border-blue-500/50'
                : currentStep === 'mapping'
                  ? 'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:scale-105'
                  : 'text-slate-500 dark:text-slate-400 cursor-default'
            }`}
            disabled={currentStep === 'workflow'}
          >
            <span className="w-5 h-5 rounded-full bg-current text-white text-xs flex items-center justify-center">2</span>
            Node
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          
          {/* Mapping Step - Never clickable, only shows current state */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
            currentStep === 'mapping' 
              ? 'bg-blue-500/80 dark:bg-blue-600/80 text-white backdrop-blur-sm border border-blue-400/50 dark:border-blue-500/50' 
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            <span className="w-5 h-5 rounded-full bg-current text-white text-xs flex items-center justify-center">3</span>
            Mapping
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            {getStepTitle()}
          </h2>
          
          {currentStep === 'workflow' && renderWorkflowStep()}
          {currentStep === 'node' && renderNodeStep()}
          {currentStep === 'mapping' && renderMappingStep()}
        </div>
      </div>
    </div>
    )}
    </div>
  );
};