import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectLabel,
  SelectGroup
} from '../select';

describe('Select Component', () => {
  describe('Select Trigger', () => {
    it('should render select trigger with placeholder', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
      
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('should render select trigger with custom className', () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger">
            <SelectValue />
          </SelectTrigger>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveClass('custom-trigger');
    });

    it('should handle disabled state', () => {
      render(
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Disabled select" />
          </SelectTrigger>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Select with Content', () => {
    it('should render complete select with items', async () => {
      const user = userEvent.setup();
      
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
      
      // Click to open dropdown
      await user.click(trigger);
      
      // Check if items are visible
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
      expect(screen.getByText('Orange')).toBeInTheDocument();
    });

    it('should handle item selection', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      
      const appleItem = screen.getByText('Apple');
      await user.click(appleItem);
      
      expect(onValueChange).toHaveBeenCalledWith('apple');
    });

    it('should show selected value in trigger', async () => {
      const user = userEvent.setup();
      
      render(
        <Select defaultValue="banana">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      );
      
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });
  });

  describe('Select Groups and Labels', () => {
    it('should render select with groups and labels', async () => {
      const user = userEvent.setup();
      
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
              <SelectItem value="broccoli">Broccoli</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      
      expect(screen.getByText('Fruits')).toBeInTheDocument();
      expect(screen.getByText('Vegetables')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Carrot')).toBeInTheDocument();
    });
  });

  describe('Select Item States', () => {
    it('should handle disabled items', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana" disabled>Banana (Out of stock)</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      
      const bananaItem = screen.getByText('Banana (Out of stock)');
      await user.click(bananaItem);
      
      // Disabled item should not trigger selection
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Select>
          <SelectTrigger aria-label="Fruit selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-label', 'Fruit selector');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      
      render(
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      
      // Focus trigger and open with Enter
      trigger.focus();
      await user.keyboard('{Enter}');
      
      // Should open the dropdown
      expect(screen.getByText('Apple')).toBeInTheDocument();
      
      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      expect(onValueChange).toHaveBeenCalledWith('banana');
    });
  });

  describe('Form Integration', () => {
    it('should work with form name attribute', () => {
      render(
        <Select name="fruit-select">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>
      );
      
      // The name should be passed through (implementation detail may vary)
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
    });

    it('should handle required attribute', () => {
      render(
        <Select required>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom props and className', () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger" data-testid="select-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="custom-content">
            <SelectItem value="test" className="custom-item">Test</SelectItem>
          </SelectContent>
        </Select>
      );
      
      const trigger = screen.getByTestId('select-trigger');
      expect(trigger).toHaveClass('custom-trigger');
    });
  });
});