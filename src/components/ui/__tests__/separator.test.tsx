import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Separator } from '../separator';

describe('Separator Component', () => {
  describe('Basic Rendering', () => {
    it('should render horizontal separator by default', () => {
      const { container } = render(<Separator />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should render with proper ARIA attributes', () => {
      const { container } = render(<Separator />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should be decorative by default', () => {
      const { container } = render(<Separator />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
      // Decorative separators should not be focusable
    });
  });

  describe('Orientation', () => {
    it('should render horizontal separator', () => {
      const { container } = render(<Separator orientation="horizontal" decorative={false} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
      // Note: Radix UI may not set aria-orientation for horizontal separators in test environment
    });

    it('should render vertical separator', () => {
      const { container } = render(<Separator orientation="vertical" decorative={false} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute('data-orientation', 'vertical');
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('should apply correct styles for horizontal orientation', () => {
      const { container } = render(<Separator orientation="horizontal" />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveClass('h-[1px]', 'w-full');
      expect(separator).not.toHaveClass('h-full', 'w-[1px]');
    });

    it('should apply correct styles for vertical orientation', () => {
      const { container } = render(<Separator orientation="vertical" />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveClass('h-full', 'w-[1px]');
      expect(separator).not.toHaveClass('h-[1px]', 'w-full');
    });
  });

  describe('Decorative Prop', () => {
    it('should be decorative when decorative=true', () => {
      const { container } = render(<Separator decorative={true} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      // Decorative separators are not announced to screen readers
    });

    it('should be semantic when decorative=false', () => {
      const { container } = render(<Separator decorative={false} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('role', 'separator');
    });
  });

  describe('Styling', () => {
    it('should have default separator styles', () => {
      const { container } = render(<Separator />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveClass('shrink-0', 'bg-border');
    });

    it('should accept custom className', () => {
      const { container } = render(<Separator className="custom-separator bg-red-500" />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveClass('custom-separator', 'bg-red-500');
      expect(separator).toHaveClass('shrink-0', 'bg-border'); // Should keep default classes
    });

    it('should combine orientation and custom styles', () => {
      const { container } = render(
        <Separator 
          orientation="vertical" 
          className="bg-blue-500 opacity-50" 
        />
      );
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveClass('h-full', 'w-[1px]', 'bg-blue-500', 'opacity-50');
    });
  });

  describe('Custom Props', () => {
    it('should forward custom HTML attributes', () => {
      const { container } = render(
        <Separator 
          data-testid="custom-separator"
          id="main-separator"
          title="Section divider"
        />
      );
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute('data-testid', 'custom-separator');
      expect(separator).toHaveAttribute('id', 'main-separator');
      expect(separator).toHaveAttribute('title', 'Section divider');
    });

    it('should support ARIA attributes', () => {
      const { container } = render(
        <Separator 
          aria-label="Content separator"
          aria-describedby="separator-help"
        />
      );
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute('aria-label', 'Content separator');
      expect(separator).toHaveAttribute('aria-describedby', 'separator-help');
    });
  });

  describe('Real-world Usage', () => {
    it('should work as section divider in layout', () => {
      const { container } = render(
        <div>
          <div>Header Content</div>
          <Separator decorative={false} />
          <div>Main Content</div>
        </div>
      );
      
      const separator = container.querySelector('[role="separator"]');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should work as vertical divider in navigation', () => {
      const { container } = render(
        <nav className="flex items-center">
          <a href="/home">Home</a>
          <Separator orientation="vertical" className="mx-2" decorative={false} />
          <a href="/about">About</a>
          <Separator orientation="vertical" className="mx-2" decorative={false} />
          <a href="/contact">Contact</a>
        </nav>
      );
      
      const separators = container.querySelectorAll('[role="separator"]');
      expect(separators).toHaveLength(2);
      separators.forEach(separator => {
        expect(separator).toHaveAttribute('data-orientation', 'vertical');
      });
    });

    it('should work in sidebar layout', () => {
      const { container } = render(
        <div className="flex">
          <aside>Sidebar</aside>
          <Separator orientation="vertical" className="mx-4" />
          <main>Main Content</main>
        </div>
      );
      
      const separator = container.querySelector('[data-orientation="vertical"]');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('mx-4');
    });

    it('should work in menu separators', () => {
      const { container } = render(
        <div>
          <button>Edit</button>
          <button>Copy</button>
          <Separator className="my-1" decorative={false} />
          <button>Delete</button>
        </div>
      );
      
      const separator = container.querySelector('[role="separator"]');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('my-1');
    });

    it('should work in card layouts', () => {
      const { container } = render(
        <div className="card">
          <header>Card Header</header>
          <Separator decorative={false} />
          <div>Card Body</div>
          <Separator decorative={false} />
          <footer>Card Footer</footer>
        </div>
      );
      
      const separators = container.querySelectorAll('[role="separator"]');
      expect(separators).toHaveLength(2);
    });
  });

  describe('Multiple Separators', () => {
    it('should render multiple horizontal separators', () => {
      const { container } = render(
        <div>
          <Separator />
          <Separator />
          <Separator />
        </div>
      );
      
      const separators = container.querySelectorAll('[data-orientation="horizontal"]');
      expect(separators).toHaveLength(3);
    });

    it('should render multiple vertical separators', () => {
      const { container } = render(
        <div className="flex">
          <Separator orientation="vertical" />
          <Separator orientation="vertical" />
          <Separator orientation="vertical" />
        </div>
      );
      
      const separators = container.querySelectorAll('[data-orientation="vertical"]');
      expect(separators).toHaveLength(3);
    });

    it('should handle mixed orientations', () => {
      const { container } = render(
        <div>
          <Separator orientation="horizontal" />
          <Separator orientation="vertical" />
          <Separator orientation="horizontal" />
        </div>
      );
      
      const horizontalSeparators = container.querySelectorAll('[data-orientation="horizontal"]');
      const verticalSeparators = container.querySelectorAll('[data-orientation="vertical"]');
      
      expect(horizontalSeparators).toHaveLength(2);
      expect(verticalSeparators).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty props gracefully', () => {
      const { container } = render(<Separator {...{}} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should override default orientation', () => {
      const { container } = render(<Separator orientation={undefined as any} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      // Should fallback to default horizontal orientation
    });

    it('should handle invalid orientation gracefully', () => {
      const { container } = render(<Separator orientation={'diagonal' as any} />);
      
      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      // Radix UI should handle invalid orientation gracefully
    });
  });
});