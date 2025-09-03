import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label Component', () => {
  describe('Basic Rendering', () => {
    it('should render label with text content', () => {
      render(<Label>Username</Label>);
      
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('should render empty label', () => {
      render(<Label />);
      
      // Label should be in DOM even if empty
      const label = document.querySelector('label');
      expect(label).toBeInTheDocument();
    });

    it('should render label with child elements', () => {
      render(
        <Label>
          <span>Required</span> Field
        </Label>
      );
      
      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(screen.getByText('Field')).toBeInTheDocument();
    });
  });

  describe('HTML Attributes', () => {
    it('should accept htmlFor attribute', () => {
      render(<Label htmlFor="username-input">Username</Label>);
      
      const label = screen.getByText('Username');
      expect(label).toHaveAttribute('for', 'username-input');
    });

    it('should forward custom HTML attributes', () => {
      render(
        <Label 
          id="username-label" 
          data-testid="custom-label"
          title="Username field label"
        >
          Username
        </Label>
      );
      
      const label = screen.getByTestId('custom-label');
      expect(label).toHaveAttribute('id', 'username-label');
      expect(label).toHaveAttribute('title', 'Username field label');
    });

    it('should support ARIA attributes', () => {
      render(
        <Label 
          aria-describedby="help-text"
          aria-required="true"
        >
          Email Address
        </Label>
      );
      
      const label = screen.getByText('Email Address');
      expect(label).toHaveAttribute('aria-describedby', 'help-text');
      expect(label).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Styling', () => {
    it('should accept custom className', () => {
      render(<Label className="custom-label">Styled Label</Label>);
      
      const label = screen.getByText('Styled Label');
      expect(label).toHaveClass('custom-label');
    });

    it('should have default label styles', () => {
      render(<Label>Default Label</Label>);
      
      const label = screen.getByText('Default Label');
      // Check for default classes from labelVariants
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none');
    });

    it('should combine default and custom classes', () => {
      render(<Label className="text-blue-500">Blue Label</Label>);
      
      const label = screen.getByText('Blue Label');
      expect(label).toHaveClass('text-sm', 'font-medium', 'text-blue-500');
    });
  });

  describe('Form Association', () => {
    it('should associate with form input using htmlFor', () => {
      render(
        <div>
          <Label htmlFor="email">Email</Label>
          <input id="email" type="email" />
        </div>
      );
      
      const label = screen.getByText('Email');
      const input = screen.getByRole('textbox');
      
      expect(label).toHaveAttribute('for', 'email');
      expect(input).toHaveAttribute('id', 'email');
    });

    it('should work with nested input elements', () => {
      render(
        <Label>
          Username
          <input type="text" />
        </Label>
      );
      
      const label = screen.getByText('Username');
      const input = screen.getByRole('textbox');
      
      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
      expect(label).toContainElement(input);
    });
  });

  describe('Content Variations', () => {
    it('should handle numeric content', () => {
      render(<Label>Field {1}</Label>);
      
      expect(screen.getByText('Field 1')).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      render(<Label>Email Address *</Label>);
      
      expect(screen.getByText('Email Address *')).toBeInTheDocument();
    });

    it('should handle long text content', () => {
      const longText = 'This is a very long label text that might wrap to multiple lines in some layouts';
      render(<Label>{longText}</Label>);
      
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should render required field indicators', () => {
      render(
        <Label>
          Password <span className="text-red-500">*</span>
        </Label>
      );
      
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible to screen readers', () => {
      render(<Label>Accessible Label</Label>);
      
      const label = screen.getByText('Accessible Label');
      expect(label).toBeInTheDocument();
      // Label element should be readable by screen readers by default
    });

    it('should support screen reader descriptions', () => {
      render(
        <div>
          <Label htmlFor="password">Password</Label>
          <p id="password-help">Must be at least 8 characters</p>
          <input 
            id="password" 
            type="password" 
            aria-describedby="password-help"
          />
        </div>
      );
      
      const label = screen.getByText('Password');
      const helpText = screen.getByText('Must be at least 8 characters');
      const input = screen.getByLabelText('Password');
      
      expect(label).toBeInTheDocument();
      expect(helpText).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-describedby', 'password-help');
    });
  });

  describe('Real-world Usage', () => {
    it('should work in login form', () => {
      render(
        <form>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <input id="email" type="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <input id="password" type="password" />
          </div>
        </form>
      );
      
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should work with checkbox input', () => {
      render(
        <div>
          <Label htmlFor="terms">
            I agree to the terms and conditions
          </Label>
          <input id="terms" type="checkbox" />
        </div>
      );
      
      const checkbox = screen.getByLabelText('I agree to the terms and conditions');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });

    it('should work with radio button group', () => {
      render(
        <div>
          <Label htmlFor="option1">Option 1</Label>
          <input id="option1" type="radio" name="choice" value="1" />
          <Label htmlFor="option2">Option 2</Label>
          <input id="option2" type="radio" name="choice" value="2" />
        </div>
      );
      
      expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined children', () => {
      render(<Label>{undefined}</Label>);
      
      const label = document.querySelector('label');
      expect(label).toBeInTheDocument();
    });

    it('should handle null children', () => {
      render(<Label>{null}</Label>);
      
      const label = document.querySelector('label');
      expect(label).toBeInTheDocument();
    });

    it('should handle boolean children', () => {
      render(<Label>{true && 'Conditional Label'}</Label>);
      
      expect(screen.getByText('Conditional Label')).toBeInTheDocument();
    });
  });
});