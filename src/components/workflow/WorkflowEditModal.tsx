import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import { Workflow } from '@/shared/types/app/IComfyWorkflow';
import { updateWorkflow, removeWorkflow } from '@/infrastructure/storage/IndexedDBWorkflowService';
import { generateWorkflowThumbnail } from '@/shared/utils/rendering/CanvasRendererService';
import { toast } from 'sonner';

interface WorkflowEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: Workflow | null;
  onWorkflowUpdated: (updatedWorkflow: Workflow) => void;
  onWorkflowDeleted?: (workflowId: string) => void;
}

const WorkflowEditModal: React.FC<WorkflowEditModalProps> = ({
  isOpen,
  onClose,
  workflow,
  onWorkflowUpdated,
  onWorkflowDeleted
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRegeneratingThumbnail, setIsRegeneratingThumbnail] = useState(false);

  // Initialize form with workflow data
  useEffect(() => {
    if (workflow && isOpen) {
      setName(workflow.name);
      setDescription(workflow.description || '');
      setTags(workflow.tags || []);
      setNewTag('');
      setShowDeleteConfirm(false);
    }
  }, [workflow, isOpen]);

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!workflow || !name.trim()) return;

    setIsLoading(true);
    try {
      const updatedWorkflow: Workflow = {
        ...workflow,
        name: name.trim(),
        description: description.trim(),
        tags: tags.filter(tag => tag.trim()),
        modifiedAt: new Date()
      };

      // Update in storage
      await updateWorkflow(updatedWorkflow);
      
      // Notify parent component
      onWorkflowUpdated(updatedWorkflow);
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to update workflow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workflow) return;

    setIsLoading(true);
    try {
      // Remove from storage
      await removeWorkflow(workflow.id);
      
      // Notify parent component
      if (onWorkflowDeleted) {
        onWorkflowDeleted(workflow.id);
      }
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!workflow) return;

    setIsRegeneratingThumbnail(true);
    try {
      // Generate new thumbnail
      const newThumbnail = generateWorkflowThumbnail({
        nodes: (workflow.workflow_json.nodes || []) as any,
        links: (workflow.workflow_json.links || []) as any,
        groups: (workflow.workflow_json.groups || []) as any
      });

      // Update workflow with new thumbnail
      const updatedWorkflow: Workflow = {
        ...workflow,
        thumbnail: newThumbnail,
        modifiedAt: new Date()
      };

      // Update in storage
      await updateWorkflow(updatedWorkflow);
      
      // Notify parent component
      onWorkflowUpdated(updatedWorkflow);
      
      toast.success('Thumbnail regenerated successfully');
    } catch (error) {
      console.error('Failed to regenerate thumbnail:', error);
      toast.error('Failed to regenerate thumbnail');
    } finally {
      setIsRegeneratingThumbnail(false);
    }
  };

  const handleClose = () => {
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!workflow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-[500px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.4)] dark:bg-slate-900/10 dark:border-slate-700/30 dark:shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">
            Edit Workflow
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Update workflow name, description, and tags
          </DialogDescription>
        </DialogHeader>

        {!showDeleteConfirm ? (
          <div className="space-y-6 py-4">
            {/* Workflow Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Workflow Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter workflow name"
                className="w-full bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50"
                autoFocus={false}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Enter workflow description (optional)"
                rows={3}
                className="w-full resize-none bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50"
              />
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tags
              </Label>
              
              {/* Existing Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-2 py-1 text-xs bg-white/50 backdrop-blur-sm border border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300"
                    >
                      {tag}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveTag(tag);
                        }}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a tag"
                  className="flex-1 bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50"
                />
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddTag();
                  }}
                  disabled={!newTag.trim()}
                  size="sm"
                  variant="outline"
                  className="bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Thumbnail Section */}
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
                Workflow Thumbnail
              </Label>
              <div className="flex items-center gap-4">
                {workflow.thumbnail ? (
                  <div className="flex-shrink-0">
                    <img 
                      src={workflow.thumbnail} 
                      alt="Workflow thumbnail"
                      className="w-20 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-20 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <span className="text-xs text-slate-400">No thumbnail</span>
                  </div>
                )}
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRegenerateThumbnail();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isRegeneratingThumbnail && !isLoading) {
                      handleRegenerateThumbnail();
                    }
                  }}
                  disabled={isRegeneratingThumbnail || isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRegeneratingThumbnail ? 'animate-spin' : ''}`} />
                  {isRegeneratingThumbnail ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>
            </div>

            {/* Workflow Info */}
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400 mb-4">
                <div>
                  <span className="font-medium">Nodes:</span> {workflow.nodeCount}
                </div>
                <div>
                  <span className="font-medium">Author:</span> {workflow.author || 'Unknown'}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {workflow.createdAt ? workflow.createdAt.toLocaleDateString() : 'Unknown'}
                </div>
                <div>
                  <span className="font-medium">Modified:</span> {workflow.modifiedAt?.toLocaleDateString() || 'Never'}
                </div>
              </div>

              {/* Delete Button - Moved here for better separation */}
              <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  variant="outline"
                  className="w-full h-12 text-red-600 border-red-200/50 hover:bg-red-50/50 backdrop-blur-sm bg-white/30 dark:text-red-400 dark:border-red-800/50 dark:hover:bg-red-900/20 dark:bg-slate-800/30"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workflow
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Delete Confirmation */
          <div className="py-6 text-center">
            <div className="mb-4">
              <Trash2 className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Delete Workflow
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to delete
              </p>
              <p className="text-slate-900 dark:text-slate-100 font-medium mt-2 mb-2 break-words break-all">
                "{workflow.name}"
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                This action cannot be undone.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-center">
          {!showDeleteConfirm ? (
            <div className="flex gap-4 w-full">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoading) {
                    handleClose();
                  }
                }}
                variant="outline"
                disabled={isLoading}
                className="flex-1 h-12 bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50 min-w-[120px]"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSave();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoading && name.trim()) {
                    handleSave();
                  }
                }}
                disabled={isLoading || !name.trim()}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600/90 to-cyan-600/90 hover:from-blue-700/90 hover:to-cyan-700/90 text-white backdrop-blur-sm border-0 min-w-[120px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 w-full">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoading) {
                    setShowDeleteConfirm(false);
                  }
                }}
                variant="outline"
                disabled={isLoading}
                className="flex-1 h-12 bg-white/50 backdrop-blur-sm border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-600/50 min-w-[120px]"
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isLoading) {
                    handleDelete();
                  }
                }}
                disabled={isLoading}
                variant="destructive"
                className="flex-1 h-12 bg-red-500/90 hover:bg-red-600/90 backdrop-blur-sm border-0 min-w-[120px]"
              >
                {isLoading ? 'Deleting...' : 'Delete Workflow'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowEditModal;