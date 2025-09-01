import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../checkbox';

describe('Checkbox Component', () => {
  describe('Basic Rendering', () => {
    it('should render checkbox element', () => {
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should render with default unchecked state', () => {
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('should render with checked state when defaultChecked is true', () => {
      render(<Checkbox defaultChecked />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('User Interactions', () => {
    it('should toggle when clicked', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
      
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should handle keyboard interaction (Space key)', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      
      expect(checkbox).not.toBeChecked();
      
      await user.keyboard(' ');
      expect(checkbox).toBeChecked();
      
      await user.keyboard(' ');
      expect(checkbox).not.toBeChecked();
    });

    it('should handle focus and blur', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      
      render(<Checkbox onFocus={handleFocus} onBlur={handleBlur} />);
      
      const checkbox = screen.getByRole('checkbox');
      
      await user.click(checkbox);
      expect(handleFocus).toHaveBeenCalledTimes(1);
      
      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Change Events', () => {
    it('should call onCheckedChange when toggled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Checkbox onCheckedChange={handleChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      
      expect(handleChange).toHaveBeenCalledWith(true);
      
      await user.click(checkbox);
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it('should work as controlled component', async () => {
      const user = userEvent.setup();
      const ControlledCheckbox = () => {
        const [checked, setChecked] = React.useState(false);
        
        return (
          <Checkbox 
            checked={checked} 
            onCheckedChange={setChecked}
          />
        );
      };
      
      render(<ControlledCheckbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
      
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('States', () => {
    it('should handle disabled state', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Checkbox disabled onCheckedChange={handleChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      
      await user.click(checkbox);
      expect(handleChange).not.toHaveBeenCalled();
      expect(checkbox).not.toBeChecked();
    });

    it('should handle indeterminate state', () => {
      render(<Checkbox checked="indeterminate" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'indeterminate');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should handle required state', () => {
      render(<Checkbox required />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeRequired();
    });
  });

  describe('Form Integration', () => {
    it('should accept name and value props', () => {
      render(<Checkbox name="agree-terms" value="yes" data-testid="checkbox" />);
      
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should work with labels', () => {
      render(
        <div>
          <Checkbox id="terms" />
          <label htmlFor="terms">I agree to the terms</label>
        </div>
      );
      
      const checkbox = screen.getByLabelText('I agree to the terms');
      expect(checkbox).toBeInTheDocument();
    });

    it('should support required attribute', () => {
      render(<Checkbox required name="required-checkbox" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeRequired();
    });
  });

  describe('Styling', () => {
    it('should have default checkbox styles', () => {
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass(
        'peer',
        'h-4',
        'w-4',
        'shrink-0',
        'rounded-sm',
        'border',
        'border-primary'
      );
    });

    it('should accept custom className', () => {
      render(<Checkbox className="custom-checkbox" />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('custom-checkbox');
      expect(checkbox).toHaveClass('peer', 'h-4', 'w-4'); // Should keep default classes
    });

    it('should show different styles when checked', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      
      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'checked');
      expect(checkbox).toHaveClass('data-[state=checked]:bg-primary');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('type', 'button');
      expect(checkbox).toHaveAttribute('role', 'checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should support custom ARIA attributes', () => {
      render(
        <Checkbox 
          aria-label="Accept terms and conditions"
          aria-describedby="terms-help"
        />
      );
      
      const checkbox = screen.getByLabelText('Accept terms and conditions');
      expect(checkbox).toHaveAttribute('aria-describedby', 'terms-help');
    });

    it('should be focusable with keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <input type="text" />
          <Checkbox />
        </div>
      );
      
      const input = screen.getByRole('textbox');
      input.focus();
      
      await user.tab();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveFocus();
    });

    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      
      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      
      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Visual State', () => {
    it('should change data-state when checked', async () => {
      const user = userEvent.setup();
      render(<Checkbox />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
      
      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Real-world Usage', () => {
    it('should work in agreement form', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      
      render(
        <form onSubmit={handleSubmit}>
          <div className="flex items-center space-x-2">
            <Checkbox id="terms" name="agree" />
            <label htmlFor="terms">
              I agree to the terms and conditions
            </label>
          </div>
          <button type="submit">Continue</button>
        </form>
      );
      
      const checkbox = screen.getByLabelText('I agree to the terms and conditions');
      await user.click(checkbox);
      
      expect(checkbox).toBeChecked();
    });

    it('should work in todo list', async () => {
      const user = userEvent.setup();
      
      render(
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="task1" />
            <label htmlFor="task1">Complete project</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="task2" defaultChecked />
            <label htmlFor="task2">Review code</label>
          </div>
        </div>
      );
      
      const task1 = screen.getByLabelText('Complete project');
      const task2 = screen.getByLabelText('Review code');
      
      expect(task1).not.toBeChecked();
      expect(task2).toBeChecked();
      
      await user.click(task1);
      expect(task1).toBeChecked();
    });

    it('should work in multi-select filters', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <h3>Filter by Category</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="tech" />
              <label htmlFor="tech">Technology</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="design" />
              <label htmlFor="design">Design</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="business" />
              <label htmlFor="business">Business</label>
            </div>
          </div>
        </div>
      );
      
      const techFilter = screen.getByLabelText('Technology');
      const designFilter = screen.getByLabelText('Design');
      
      await user.click(techFilter);
      await user.click(designFilter);
      
      expect(techFilter).toBeChecked();
      expect(designFilter).toBeChecked();
      expect(screen.getByLabelText('Business')).not.toBeChecked();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined props gracefully', () => {
      render(<Checkbox {...{checked: undefined, onChange: undefined}} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should handle rapid clicking', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Checkbox onCheckedChange={handleChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      
      // Rapid clicks
      await user.click(checkbox);
      await user.click(checkbox);
      await user.click(checkbox);
      
      expect(handleChange).toHaveBeenCalledTimes(3);
      expect(checkbox).toBeChecked(); // Should end up checked (odd number of clicks)
    });
  });
});