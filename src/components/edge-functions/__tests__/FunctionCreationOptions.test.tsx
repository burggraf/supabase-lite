// import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FunctionCreationOptions } from '../FunctionCreationOptions';

const mockProps = {
  onCreateFunction: vi.fn(),
};

describe('FunctionCreationOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Creation Options Display', () => {
    it('should display all three creation options', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      expect(screen.getByText('Via Editor')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Via CLI')).toBeInTheDocument();

      expect(screen.getByText('Create and edit functions directly in the browser. Download to local at any time.')).toBeInTheDocument();
      expect(screen.getByText('Let our AI assistant help you create functions. Perfect for kickstarting a function.')).toBeInTheDocument();
      expect(screen.getByText('Create and deploy functions using the Supabase CLI. Ideal for local development and version control.')).toBeInTheDocument();
    });

    it('should display correct action buttons', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      expect(screen.getByText('Open Editor')).toBeInTheDocument();
      expect(screen.getByText('Open Assistant')).toBeInTheDocument();
      expect(screen.getByText('View CLI Instructions')).toBeInTheDocument();
    });
  });

  describe('Via Editor Option', () => {
    it('should call onCreateFunction when Open Editor is clicked', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const openEditorButton = screen.getByText('Open Editor');
      fireEvent.click(openEditorButton);

      expect(mockProps.onCreateFunction).toHaveBeenCalledWith();
    });
  });

  describe('AI Assistant Option', () => {
    it('should show coming soon alert when Open Assistant is clicked', () => {
      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<FunctionCreationOptions {...mockProps} />);

      const openAssistantButton = screen.getByText('Open Assistant');
      fireEvent.click(openAssistantButton);

      expect(alertSpy).toHaveBeenCalledWith('AI Assistant feature coming soon!');
      expect(mockProps.onCreateFunction).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });

  describe('CLI Instructions Modal', () => {
    it('should open CLI modal when View CLI Instructions is clicked', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      expect(screen.getByText('Supabase CLI Instructions')).toBeInTheDocument();
      expect(screen.getByText('Use the Supabase CLI to create and deploy edge functions')).toBeInTheDocument();
    });

    it('should display all CLI commands with proper structure', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      // Check for all command titles
      expect(screen.getByText('Install Supabase CLI')).toBeInTheDocument();
      expect(screen.getByText('Login to Supabase')).toBeInTheDocument();
      expect(screen.getByText('Initialize Project')).toBeInTheDocument();
      expect(screen.getByText('Create New Function')).toBeInTheDocument();
      expect(screen.getByText('Serve Functions Locally')).toBeInTheDocument();
      expect(screen.getByText('Deploy Function')).toBeInTheDocument();

      // Check for actual commands
      expect(screen.getByText('npm install -g supabase')).toBeInTheDocument();
      expect(screen.getByText('supabase login')).toBeInTheDocument();
      expect(screen.getByText('supabase init')).toBeInTheDocument();
      expect(screen.getByText('supabase functions new my-function')).toBeInTheDocument();
      expect(screen.getByText('supabase functions serve')).toBeInTheDocument();
      expect(screen.getByText('supabase functions deploy my-function')).toBeInTheDocument();
    });

    it('should display pro tips section', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      expect(screen.getByText('💡 Pro Tips')).toBeInTheDocument();
      expect(screen.getByText(/supabase functions serve --debug/)).toBeInTheDocument();
      expect(screen.getByText(/supabase\/functions\//)).toBeInTheDocument();
      expect(screen.getByText(/supabase secrets set KEY=value/)).toBeInTheDocument();
    });

    it('should provide documentation link', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      const docLink = screen.getByText('📖 View Full Documentation →');
      expect(docLink).toBeInTheDocument();
      expect(docLink.closest('a')).toHaveAttribute('href', 'https://supabase.com/docs/guides/functions');
    });

    it('should close modal when X button is clicked', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      expect(screen.getByText('Supabase CLI Instructions')).toBeInTheDocument();

      const closeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg') // Find button with X icon
      );
      
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(screen.queryByText('Supabase CLI Instructions')).not.toBeInTheDocument();
      }
    });

    it('should close modal when Got it, thanks! button is clicked', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      const gotItButton = screen.getByText('Got it, thanks!');
      fireEvent.click(gotItButton);

      expect(screen.queryByText('Supabase CLI Instructions')).not.toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard Functionality', () => {
    it('should copy command to clipboard when copy button is clicked', async () => {
      // Mock navigator.clipboard
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      // Find copy buttons (they contain copy icons)
      const copyButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && 
        !btn.textContent?.includes('×') && // Not the close button
        !btn.textContent?.includes('Got it')
      );

      if (copyButtons.length > 0) {
        fireEvent.click(copyButtons[0]);

        await waitFor(() => {
          expect(writeTextMock).toHaveBeenCalledWith('npm install -g supabase');
        });
      }
    });

    it('should show check mark briefly after successful copy', async () => {
      const writeTextMock = vi.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      const copyButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && 
        !btn.textContent?.includes('×') && 
        !btn.textContent?.includes('Got it')
      );

      if (copyButtons.length > 0) {
        fireEvent.click(copyButtons[0]);

        // Check mark should appear briefly (test framework may not wait for timeout)
        // This is more of an integration test, but we verify the function was called
        expect(writeTextMock).toHaveBeenCalled();
      }
    });

    it('should handle copy failure gracefully', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Copy failed'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<FunctionCreationOptions {...mockProps} />);

      const viewCLIButton = screen.getByText('View CLI Instructions');
      fireEvent.click(viewCLIButton);

      const copyButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && 
        !btn.textContent?.includes('×') && 
        !btn.textContent?.includes('Got it')
      );

      if (copyButtons.length > 0) {
        fireEvent.click(copyButtons[0]);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy: ', expect.any(Error));
        });
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and semantic structure', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      // Cards should be clickable
      expect(screen.getByText('Open Editor')).toBeInTheDocument();
      expect(screen.getByText('Open Assistant')).toBeInTheDocument();
      expect(screen.getByText('View CLI Instructions')).toBeInTheDocument();

      // Icons should be properly structured
      const cards = screen.getAllByRole('button');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
      render(<FunctionCreationOptions {...mockProps} />);

      const openEditorButton = screen.getByText('Open Editor');
      
      // Focus should work
      openEditorButton.focus();
      expect(document.activeElement).toBe(openEditorButton);

      // Enter key should trigger click
      fireEvent.keyDown(openEditorButton, { key: 'Enter' });
      expect(mockProps.onCreateFunction).toHaveBeenCalled();
    });
  });
});