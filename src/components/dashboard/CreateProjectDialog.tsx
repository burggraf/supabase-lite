import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database } from 'lucide-react';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (name: string) => Promise<void>;
  existingNames: string[];
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
  existingNames
}: CreateProjectDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isCreating) return;
    setProjectName('');
    setError(null);
    onOpenChange(false);
  };

  const validateName = (name: string): string | null => {
    const trimmed = name.trim();
    
    if (!trimmed) {
      return 'Project name is required';
    }
    
    if (trimmed.length < 2) {
      return 'Project name must be at least 2 characters';
    }
    
    if (trimmed.length > 50) {
      return 'Project name must be less than 50 characters';
    }
    
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      return 'Project name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    
    if (existingNames.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      return 'A project with this name already exists';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateName(projectName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreateProject(projectName.trim());
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const currentError = error || validateName(projectName);
  const isValid = !currentError && projectName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Create New Project
          </DialogTitle>
          <DialogDescription>
            Create a new project with its own isolated database. Each project will have separate tables, data, and schemas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setError(null);
              }}
              disabled={isCreating}
              autoFocus
            />
            {currentError && projectName.trim() && (
              <p className="text-sm text-destructive">{currentError}</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}