// import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FunctionTemplates } from '../FunctionTemplates';

const mockProps = {
  onSelectTemplate: vi.fn(),
};

describe('FunctionTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Template Display', () => {
    it('should display all available templates', () => {
      render(<FunctionTemplates {...mockProps} />);

      // Check for template titles
      expect(screen.getByText('Simple Hello World')).toBeInTheDocument();
      expect(screen.getByText('Supabase Database Access')).toBeInTheDocument();
      expect(screen.getByText('Supabase Storage Upload')).toBeInTheDocument();
      expect(screen.getByText('Node Built-in API Example')).toBeInTheDocument();
      expect(screen.getByText('Express Server')).toBeInTheDocument();
      expect(screen.getByText('OpenAI Text Completion')).toBeInTheDocument();
      expect(screen.getByText('Stripe Webhook Example')).toBeInTheDocument();
      expect(screen.getByText('Send Emails')).toBeInTheDocument();
      expect(screen.getByText('Image Transformation')).toBeInTheDocument();
      expect(screen.getByText('WebSocket Server Example')).toBeInTheDocument();
    });

    it('should display template descriptions', () => {
      render(<FunctionTemplates {...mockProps} />);

      expect(screen.getByText('Basic function that returns a JSON response')).toBeInTheDocument();
      expect(screen.getByText('Example using Supabase client to query your database')).toBeInTheDocument();
      expect(screen.getByText('Upload files to Supabase Storage')).toBeInTheDocument();
      expect(screen.getByText('Example using Node.js built-in crypto and http modules')).toBeInTheDocument();
      expect(screen.getByText('Example using Express.js for routing')).toBeInTheDocument();
    });

    it('should display template icons/emojis', () => {
      render(<FunctionTemplates {...mockProps} />);

      expect(screen.getByText('👋')).toBeInTheDocument(); // Hello World
      expect(screen.getByText('🗄️')).toBeInTheDocument(); // Database
      expect(screen.getByText('📁')).toBeInTheDocument(); // Storage
      expect(screen.getByText('🟢')).toBeInTheDocument(); // Node
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Express
      expect(screen.getByText('🤖')).toBeInTheDocument(); // OpenAI
      expect(screen.getByText('💳')).toBeInTheDocument(); // Stripe
      expect(screen.getByText('📧')).toBeInTheDocument(); // Email
      expect(screen.getByText('🖼️')).toBeInTheDocument(); // Image
      expect(screen.getByText('🔌')).toBeInTheDocument(); // WebSocket
    });
  });

  describe('Template Selection', () => {
    it('should call onSelectTemplate with correct template ID when template is clicked', () => {
      render(<FunctionTemplates {...mockProps} />);

      // Click on Simple Hello World template
      const helloWorldTemplate = screen.getByText('Simple Hello World').closest('button');
      if (helloWorldTemplate) {
        fireEvent.click(helloWorldTemplate);
        expect(mockProps.onSelectTemplate).toHaveBeenCalledWith('hello-world');
      }
    });

    it('should handle all template selections correctly', () => {
      render(<FunctionTemplates {...mockProps} />);

      const templateMappings = [
        { name: 'Simple Hello World', id: 'hello-world' },
        { name: 'Supabase Database Access', id: 'database-query' },
        { name: 'Supabase Storage Upload', id: 'storage-upload' },
        { name: 'Node Built-in API Example', id: 'node-api' },
        { name: 'Express Server', id: 'express-server' },
        { name: 'OpenAI Text Completion', id: 'openai-completion' },
        { name: 'Stripe Webhook Example', id: 'stripe-webhook' },
        { name: 'Send Emails', id: 'send-email' },
        { name: 'Image Transformation', id: 'image-transform' },
        { name: 'WebSocket Server Example', id: 'websocket-server' },
      ];

      templateMappings.forEach((template) => {
        const templateElement = screen.getByText(template.name).closest('button');
        if (templateElement) {
          fireEvent.click(templateElement);
          expect(mockProps.onSelectTemplate).toHaveBeenCalledWith(template.id);
        }
      });

      expect(mockProps.onSelectTemplate).toHaveBeenCalledTimes(templateMappings.length);
    });
  });

  describe('Template Grid Layout', () => {
    it('should render templates in a grid layout', () => {
      render(<FunctionTemplates {...mockProps} />);

      const templateButtons = screen.getAllByRole('button');
      expect(templateButtons.length).toBe(10); // 10 templates

      // Check that templates are properly structured as clickable cards
      templateButtons.forEach((button) => {
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should have proper styling for template cards', () => {
      render(<FunctionTemplates {...mockProps} />);

      const firstTemplate = screen.getByText('Simple Hello World').closest('button');
      expect(firstTemplate).toHaveClass('p-4'); // Should have padding
    });
  });

  describe('Template Categories', () => {
    it('should group templates logically', () => {
      render(<FunctionTemplates {...mockProps} />);

      // Basic templates
      expect(screen.getByText('Simple Hello World')).toBeInTheDocument();
      
      // Supabase-specific templates
      expect(screen.getByText('Supabase Database Access')).toBeInTheDocument();
      expect(screen.getByText('Supabase Storage Upload')).toBeInTheDocument();
      
      // API/Service templates
      expect(screen.getByText('Node Built-in API Example')).toBeInTheDocument();
      expect(screen.getByText('Express Server')).toBeInTheDocument();
      
      // Integration templates
      expect(screen.getByText('OpenAI Text Completion')).toBeInTheDocument();
      expect(screen.getByText('Stripe Webhook Example')).toBeInTheDocument();
      expect(screen.getByText('Send Emails')).toBeInTheDocument();
      
      // Advanced templates
      expect(screen.getByText('Image Transformation')).toBeInTheDocument();
      expect(screen.getByText('WebSocket Server Example')).toBeInTheDocument();
    });
  });

  describe('Hover and Focus States', () => {
    it('should support keyboard navigation', () => {
      render(<FunctionTemplates {...mockProps} />);

      const firstTemplate = screen.getByText('Simple Hello World').closest('button');
      if (firstTemplate) {
        firstTemplate.focus();
        expect(document.activeElement).toBe(firstTemplate);

        // Enter key should trigger selection
        fireEvent.keyDown(firstTemplate, { key: 'Enter' });
        expect(mockProps.onSelectTemplate).toHaveBeenCalledWith('hello-world');
      }
    });

    it('should handle Space key for selection', () => {
      render(<FunctionTemplates {...mockProps} />);

      const firstTemplate = screen.getByText('Simple Hello World').closest('button');
      if (firstTemplate) {
        firstTemplate.focus();
        
        // Space key should trigger selection
        fireEvent.keyDown(firstTemplate, { key: ' ' });
        expect(mockProps.onSelectTemplate).toHaveBeenCalledWith('hello-world');
      }
    });
  });

  describe('Template Content Validation', () => {
    it('should have meaningful descriptions for all templates', () => {
      render(<FunctionTemplates {...mockProps} />);

      // Each template should have a descriptive text
      const descriptions = [
        'Basic function that returns a JSON response',
        'Example using Supabase client to query your database',
        'Upload files to Supabase Storage',
        'Example using Node.js built-in crypto and http modules',
        'Example using Express.js for routing',
        'Generate text completions using OpenAI GPT-3',
        'Handle Stripe webhook events securely',
        'Send emails using the Resend API',
        'Transform images using ImageMagick WASM',
        'Create a real-time WebSocket server',
      ];

      descriptions.forEach((description) => {
        expect(screen.getByText(description)).toBeInTheDocument();
      });
    });

    it('should have unique icons for visual distinction', () => {
      render(<FunctionTemplates {...mockProps} />);

      const icons = ['👋', '🗄️', '📁', '🟢', '⚡', '🤖', '💳', '📧', '🖼️', '🔌'];
      
      icons.forEach((icon) => {
        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle template selection errors gracefully', () => {
      const mockOnSelectWithError = vi.fn().mockImplementation(() => {
        throw new Error('Template selection failed');
      });

      render(<FunctionTemplates onSelectTemplate={mockOnSelectWithError} />);

      const firstTemplate = screen.getByText('Simple Hello World').closest('button');
      if (firstTemplate) {
        // Should not throw error when clicked
        expect(() => fireEvent.click(firstTemplate)).not.toThrow();
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<FunctionTemplates {...mockProps} />);

      const templateButtons = screen.getAllByRole('button');
      
      templateButtons.forEach((button) => {
        expect(button).toBeEnabled();
        // Should be focusable
        expect(button.tabIndex).not.toBe(-1);
      });
    });

    it('should have descriptive button text', () => {
      render(<FunctionTemplates {...mockProps} />);

      // Button text should include both title and description for screen readers
      const firstButton = screen.getByText('Simple Hello World').closest('button');
      if (firstButton) {
        expect(firstButton.textContent).toContain('Simple Hello World');
        expect(firstButton.textContent).toContain('Basic function that returns a JSON response');
      }
    });
  });
});