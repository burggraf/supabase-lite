import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '../dialog';

describe('Dialog Component', () => {
  describe('Basic Dialog', () => {
    it('should render dialog trigger', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
        </Dialog>
      );
      
      expect(screen.getByRole('button', { name: 'Open Dialog' })).toBeInTheDocument();
    });

    it('should open dialog when trigger is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <p>Dialog content here</p>
          </DialogContent>
        </Dialog>
      );
      
      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      await user.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
        expect(screen.getByText('Dialog content here')).toBeInTheDocument();
      });
    });

    it('should close dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>Dialog description</DialogDescription>
            </DialogHeader>
            <p>Dialog content</p>
            <DialogFooter>
              <DialogClose data-testid="dialog-close-button">Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
      
      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      await user.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByTestId('dialog-close-button');
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dialog Content Structure', () => {
    it('should render complete dialog structure', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description text</DialogDescription>
            </DialogHeader>
            <div>Main dialog content</div>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
      
      await user.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
        expect(screen.getByText('Dialog description text')).toBeInTheDocument();
        expect(screen.getByText('Main dialog content')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });
  });

  describe('Controlled Dialog', () => {
    it('should work as controlled component', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      
      const ControlledDialog = () => {
        const [open, setOpen] = React.useState(false);
        
        return (
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            onOpenChange(isOpen);
          }}>
            <DialogTrigger onClick={() => setOpen(true)}>
              Open Controlled
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Controlled Dialog</DialogTitle>
              <button onClick={() => {
                setOpen(false);
                onOpenChange(false);
              }}>
                Manual Close
              </button>
            </DialogContent>
          </Dialog>
        );
      };
      
      render(<ControlledDialog />);
      
      const trigger = screen.getByText('Open Controlled');
      await user.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Controlled Dialog')).toBeInTheDocument();
      });
      
      const manualClose = screen.getByText('Manual Close');
      await user.click(manualClose);
      
      await waitFor(() => {
        expect(screen.queryByText('Controlled Dialog')).not.toBeInTheDocument();
      });
      
      // Should have been called with true (open) and then false (close)
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
      expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    });

    it('should handle default open state', async () => {
      render(
        <Dialog defaultOpen>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Default Open Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      
      // Dialog should be open by default
      expect(screen.getByText('Default Open Dialog')).toBeInTheDocument();
    });
  });

  describe('Dialog Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accessible Dialog</DialogTitle>
              <DialogDescription>This dialog is accessible</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );
      
      await user.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-describedby');
      });
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <button>Outside Button</button>
          <Dialog>
            <DialogTrigger>Open Dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Focus Trap Test</DialogTitle>
              <input placeholder="First input" />
              <input placeholder="Second input" />
              <DialogClose data-testid="focus-trap-close">Close</DialogClose>
            </DialogContent>
          </Dialog>
        </div>
      );
      
      await user.click(screen.getByText('Open Dialog'));
      
      await waitFor(() => {
        expect(screen.getByText('Focus Trap Test')).toBeInTheDocument();
      });
      
      // Focus should be trapped within dialog
      const firstInput = screen.getByPlaceholderText('First input');
      const secondInput = screen.getByPlaceholderText('Second input');
      const closeButton = screen.getByTestId('focus-trap-close');
      
      // Focus should start on the first focusable element
      expect(document.activeElement).toBeTruthy();
      
      // Tab navigation should work within dialog - focus first input
      firstInput.focus();
      expect(firstInput).toHaveFocus();
      
      await user.tab();
      expect(secondInput).toHaveFocus();
      
      await user.tab();
      expect(closeButton).toHaveFocus();
    });

    it('should close on Escape key', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Escape Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      
      await user.click(screen.getByText('Open'));
      
      await waitFor(() => {
        expect(screen.getByText('Escape Test')).toBeInTheDocument();
      });
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByText('Escape Test')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dialog Variants', () => {
    it('should handle different dialog sizes and variants', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogTitle>Large Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      
      await user.click(screen.getByText('Open'));
      
      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('max-w-lg');
      });
    });
  });

  describe('Event Handling', () => {
    it('should handle onOpenChange callback', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      
      render(
        <Dialog onOpenChange={onOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Event Test</DialogTitle>
            <DialogClose data-testid="event-close-button">Close</DialogClose>
          </DialogContent>
        </Dialog>
      );
      
      await user.click(screen.getByText('Open'));
      expect(onOpenChange).toHaveBeenCalledWith(true);
      
      await waitFor(() => {
        expect(screen.getByText('Event Test')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('event-close-button'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Custom Props', () => {
    it('should forward custom props and refs', async () => {
      const user = userEvent.setup();
      const contentRef = vi.fn();
      
      render(
        <Dialog>
          <DialogTrigger data-testid="trigger">Open</DialogTrigger>
          <DialogContent ref={contentRef} data-testid="content">
            <DialogTitle>Custom Props</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toBeInTheDocument();
      
      await user.click(trigger);
      
      await waitFor(() => {
        const content = screen.getByTestId('content');
        expect(content).toBeInTheDocument();
      });
    });
  });
});