import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';

describe('Tabs Components', () => {
  const user = userEvent.setup();

  describe('Tabs', () => {
    it('should render basic tab structure', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('should switch tabs when triggers are clicked', async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

      await user.click(screen.getByText('Tab 2'));

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('should handle controlled value changes', () => {
      const { rerender } = render(
        <Tabs value="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      rerender(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('TabsList', () => {
    it('should render with proper styling classes', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const tabsList = container.querySelector('[role="tablist"]') as HTMLElement;
      expect(tabsList).toHaveClass('inline-flex', 'h-10', 'items-center', 'justify-center');
    });

    it('should accept custom className', () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-class">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const tabsList = container.querySelector('[role="tablist"]') as HTMLElement;
      expect(tabsList).toHaveClass('custom-class');
    });
  });

  describe('TabsTrigger', () => {
    it('should render with proper styling classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByText('Tab 1');
      expect(trigger).toHaveClass('inline-flex', 'items-center', 'justify-center');
    });

    it('should accept custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      );

      const trigger = screen.getByText('Tab 1');
      expect(trigger).toHaveClass('custom-trigger');
    });

    it('should be accessible via keyboard navigation', async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByText('Tab 1');
      const tab2 = screen.getByText('Tab 2');

      await user.tab();
      expect(tab1).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(tab2).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(tab1).toHaveFocus();
    });
  });

  describe('TabsContent', () => {
    it('should render with proper styling classes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );

      const content = screen.getByText('Content 1');
      expect(content).toHaveClass('mt-2', 'ring-offset-background');
    });

    it('should accept custom className', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsContent value="tab1" className="custom-content">Content 1</TabsContent>
        </Tabs>
      );

      const content = screen.getByText('Content 1');
      expect(content).toHaveClass('custom-content');
    });

    it('should only show content for active tab', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByText('Tab 1');
      const tab2 = screen.getByText('Tab 2');
      const content1 = screen.getByText('Content 1');

      expect(tab1).toHaveAttribute('role', 'tab');
      expect(tab2).toHaveAttribute('role', 'tab');
      expect(content1).toHaveAttribute('role', 'tabpanel');
      
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
    });

    it('should support keyboard navigation', async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      await user.tab();
      expect(screen.getByText('Tab 1')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByText('Tab 2')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });
});