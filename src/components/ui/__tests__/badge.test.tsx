import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge Component', () => {
  describe('Basic Rendering', () => {
    it('should render badge with text content', () => {
      render(<Badge>Test Badge</Badge>);
      
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('should render badge with default variant', () => {
      render(<Badge>Default Badge</Badge>);
      
      const badge = screen.getByText('Default Badge');
      expect(badge).toBeInTheDocument();
    });

    it('should render empty badge', () => {
      render(<Badge></Badge>);
      
      // Badge should still be in DOM even if empty
      const badge = screen.getByRole('generic', { hidden: true }) || document.querySelector('[class*="badge"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Badge Variants', () => {
    it('should render default variant badge', () => {
      render(<Badge variant="default">Default</Badge>);
      
      const badge = screen.getByText('Default');
      expect(badge).toBeInTheDocument();
    });

    it('should render secondary variant badge', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      
      const badge = screen.getByText('Secondary');
      expect(badge).toBeInTheDocument();
    });

    it('should render destructive variant badge', () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      
      const badge = screen.getByText('Destructive');
      expect(badge).toBeInTheDocument();
    });

    it('should render outline variant badge', () => {
      render(<Badge variant="outline">Outline</Badge>);
      
      const badge = screen.getByText('Outline');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Custom Content', () => {
    it('should render badge with number content', () => {
      render(<Badge>42</Badge>);
      
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render badge with special characters', () => {
      render(<Badge>★ Featured</Badge>);
      
      expect(screen.getByText('★ Featured')).toBeInTheDocument();
    });

    it('should render badge with mixed content', () => {
      render(
        <Badge>
          New <span className="font-bold">Update</span>
        </Badge>
      );
      
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(<Badge className="custom-badge">Styled Badge</Badge>);
      
      const badge = screen.getByText('Styled Badge');
      expect(badge).toHaveClass('custom-badge');
    });

    it('should forward custom props', () => {
      render(<Badge data-testid="custom-badge">Test</Badge>);
      
      const badge = screen.getByTestId('custom-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Test');
    });

    it('should handle custom HTML attributes', () => {
      render(<Badge id="unique-badge" title="Badge tooltip">Attributed</Badge>);
      
      const badge = screen.getByText('Attributed');
      expect(badge).toHaveAttribute('id', 'unique-badge');
      expect(badge).toHaveAttribute('title', 'Badge tooltip');
    });
  });

  describe('Real-world Usage', () => {
    it('should render status badges', () => {
      render(
        <div>
          <Badge variant="default">Active</Badge>
          <Badge variant="secondary">Pending</Badge>
          <Badge variant="destructive">Inactive</Badge>
        </div>
      );
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('should render count badges', () => {
      render(
        <div>
          <Badge>5</Badge>
          <Badge>99+</Badge>
          <Badge>New</Badge>
        </div>
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('99+')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should render category badges', () => {
      render(
        <div>
          <Badge variant="outline">Frontend</Badge>
          <Badge variant="outline">React</Badge>
          <Badge variant="outline">TypeScript</Badge>
        </div>
      );
      
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible to screen readers', () => {
      render(<Badge>Important</Badge>);
      
      const badge = screen.getByText('Important');
      expect(badge).toBeInTheDocument();
      // Badge should be readable by screen readers by default
    });

    it('should support ARIA labels', () => {
      render(<Badge aria-label="Notification count">3</Badge>);
      
      const badge = screen.getByLabelText('Notification count');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('should support role attributes', () => {
      render(<Badge role="status">Online</Badge>);
      
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Online');
    });
  });

  describe('Multiple Badges', () => {
    it('should render multiple badges with different variants', () => {
      render(
        <div>
          <Badge variant="default">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      );
      
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Outline')).toBeInTheDocument();
    });

    it('should handle badge groups', () => {
      render(
        <div className="badge-group">
          <Badge>Tag 1</Badge>
          <Badge>Tag 2</Badge>
          <Badge>Tag 3</Badge>
        </div>
      );
      
      const badges = screen.getAllByText(/Tag \d/);
      expect(badges).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const longText = 'This is a very long badge text that might overflow';
      render(<Badge>{longText}</Badge>);
      
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should handle special characters and emojis', () => {
      render(<Badge>🎉 Celebration! ✨</Badge>);
      
      expect(screen.getByText('🎉 Celebration! ✨')).toBeInTheDocument();
    });

    it('should handle numeric content of different types', () => {
      render(
        <div>
          <Badge>{0}</Badge>
          <Badge>{42}</Badge>
          <Badge>{-5}</Badge>
          <Badge>{3.14}</Badge>
        </div>
      );
      
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('-5')).toBeInTheDocument();
      expect(screen.getByText('3.14')).toBeInTheDocument();
    });
  });
});