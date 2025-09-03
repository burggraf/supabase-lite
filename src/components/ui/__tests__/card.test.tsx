import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '../card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render card with default styling', () => {
      render(<Card data-testid="card">Card content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('Card content');
    });

    it('should accept custom className', () => {
      render(<Card className="custom-card">Content</Card>);
      const card = screen.getByText('Content');
      expect(card).toHaveClass('custom-card');
    });

    it('should forward refs correctly', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Test</Card>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('CardHeader', () => {
    it('should render card header', () => {
      render(<CardHeader data-testid="header">Header content</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Header content');
    });

    it('should accept custom props', () => {
      render(<CardHeader className="custom-header">Header</CardHeader>);
      const header = screen.getByText('Header');
      expect(header).toHaveClass('custom-header');
    });
  });

  describe('CardTitle', () => {
    it('should render card title with proper heading level', () => {
      render(<CardTitle>Card Title</CardTitle>);
      const title = screen.getByText('Card Title');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H3');
    });

    it('should accept custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>);
      const title = screen.getByText('Title');
      expect(title).toHaveClass('custom-title');
    });
  });

  describe('CardDescription', () => {
    it('should render card description', () => {
      render(<CardDescription>Card description text</CardDescription>);
      const description = screen.getByText('Card description text');
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe('P');
    });

    it('should accept custom props', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>);
      const description = screen.getByText('Description');
      expect(description).toHaveClass('custom-desc');
    });
  });

  describe('CardContent', () => {
    it('should render card content', () => {
      render(<CardContent>Main content</CardContent>);
      const content = screen.getByText('Main content');
      expect(content).toBeInTheDocument();
    });

    it('should accept custom styling', () => {
      render(<CardContent className="custom-content">Content</CardContent>);
      const content = screen.getByText('Content');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('CardFooter', () => {
    it('should render card footer', () => {
      render(<CardFooter>Footer content</CardFooter>);
      const footer = screen.getByText('Footer content');
      expect(footer).toBeInTheDocument();
    });

    it('should accept custom props', () => {
      render(<CardFooter className="custom-footer">Footer</CardFooter>);
      const footer = screen.getByText('Footer');
      expect(footer).toHaveClass('custom-footer');
    });
  });

  describe('Complete Card Structure', () => {
    it('should render complete card with all components', () => {
      render(
        <Card data-testid="complete-card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Main card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      );

      const card = screen.getByTestId('complete-card');
      expect(card).toBeInTheDocument();
      
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('This is a test card description')).toBeInTheDocument();
      expect(screen.getByText('Main card content goes here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('should maintain proper semantic structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Semantic Test</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent('Semantic Test');
    });
  });
});