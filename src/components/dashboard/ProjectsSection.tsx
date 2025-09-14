import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Folder, Plus, Trash2, Edit, Database } from 'lucide-react';
import { CreateProjectDialog } from './CreateProjectDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { Project } from '@/lib/projects/ProjectManager';

interface ProjectsSectionProps {
  projects: Project[];
  activeProject: Project | null;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSwitchProject: (projectId: string) => Promise<void>;
  onUpdateProjectName: (projectId: string, newName: string) => Promise<void>;
  isLoading?: boolean;
}

export function ProjectsSection({
  projects,
  activeProject: _activeProject,
  onCreateProject,
  onDeleteProject,
  onSwitchProject,
  onUpdateProjectName,
  isLoading = false
}: ProjectsSectionProps) {
  void _activeProject; // Intentionally unused - available for future use
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateProject = async (name: string) => {
    try {
      await onCreateProject(name);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const handleDeleteProject = async () => {
    if (deleteProjectId) {
      try {
        await onDeleteProject(deleteProjectId);
        setDeleteProjectId(null);
      } catch (error) {
        console.error('Failed to delete project:', error);
        throw error;
      }
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    try {
      // Always attempt to switch, even if UI shows project as "active"
      // This ensures the actual database connection matches the UI state
      await onSwitchProject(projectId);
    } catch (error) {
      console.error('🔄 Failed to switch project:', error);
    }
  };

  const startEditing = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleUpdateName = async (projectId: string) => {
    if (!editingName.trim()) {
      cancelEditing();
      return;
    }

    try {
      await onUpdateProjectName(projectId, editingName.trim());
      setEditingProjectId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update project name:', error);
    }
  };

  const projectToDelete = deleteProjectId ? projects.find(p => p.id === deleteProjectId) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Projects
              </CardTitle>
              <CardDescription>
                Manage your project databases
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to get started with your local database
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    project.isActive
                      ? 'bg-primary/10 border-primary/30'
                      : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                  onClick={() => handleSwitchProject(project.id)}
                >
                  <div className="flex items-center gap-3">
                    <Database className={`h-4 w-4 ${project.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      {editingProjectId === project.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateName(project.id);
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            onBlur={() => handleUpdateName(project.id)}
                            className="px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{project.name}</h4>
                            {project.isActive && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded max-w-fit">
                              ID: {project.id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created {project.createdAt.toLocaleDateString()}
                              {project.lastAccessed.getTime() !== project.createdAt.getTime() && (
                                <span> • Last accessed {project.lastAccessed.toLocaleDateString()}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {editingProjectId !== project.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(project);
                        }}
                        disabled={isLoading}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteProjectId(project.id);
                        }}
                        disabled={isLoading || projects.length === 1}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateProject={handleCreateProject}
        existingNames={projects.map(p => p.name)}
      />

      <DeleteConfirmDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
        onConfirm={handleDeleteProject}
        projectName={projectToDelete?.name || ''}
        isActive={projectToDelete?.isActive || false}
      />
    </>
  );
}