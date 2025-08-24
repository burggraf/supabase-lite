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
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string | null;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  tableName,
  onConfirm
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  
  const isConfirmed = confirmText === tableName;

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <span>Delete Table</span>
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the table and all its data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will permanently delete the table{' '}
              <code className="font-mono bg-destructive/20 px-1 rounded">
                {tableName}
              </code>{' '}
              and all of its data. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirmText">
              Type <strong>{tableName}</strong> to confirm deletion:
            </Label>
            <Input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tableName || ''}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!isConfirmed}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}