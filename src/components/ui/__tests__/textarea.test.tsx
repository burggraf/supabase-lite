import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../textarea';

describe('Textarea Component', () => {
  describe('Basic Rendering', () => {
    it('should render textarea element', () => {
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render with placeholder text', () => {
      render(<Textarea placeholder="Enter your message..." />);
      
      const textarea = screen.getByPlaceholderText('Enter your message...');
      expect(textarea).toBeInTheDocument();
    });

    it('should render with default value', () => {
      render(<Textarea defaultValue="Default text content" />);
      
      const textarea = screen.getByDisplayValue('Default text content');
      expect(textarea).toBeInTheDocument();
    });

    it('should render with controlled value', () => {
      render(<Textarea value="Controlled text" readOnly />);
      
      const textarea = screen.getByDisplayValue('Controlled text');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      render(<Textarea placeholder="Type here..." />);
      
      const textarea = screen.getByPlaceholderText('Type here...');
      await user.type(textarea, 'Hello, World!');
      
      expect(textarea).toHaveValue('Hello, World!');
    });

    it('should handle multiline text input', async () => {
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Line 1{enter}Line 2{enter}Line 3');
      
      expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
    });

    it('should handle text selection', async () => {
      const user = userEvent.setup();
      render(<Textarea defaultValue="Select this text" />);
      
      const textarea = screen.getByDisplayValue('Select this text');
      await user.tripleClick(textarea);
      
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe('Select this text'.length);
    });

    it('should handle focus and blur events', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      
      render(
        <Textarea 
          placeholder="Focus test"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      );
      
      const textarea = screen.getByPlaceholderText('Focus test');
      
      await user.click(textarea);
      expect(handleFocus).toHaveBeenCalledTimes(1);
      
      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Change Events', () => {
    it('should handle onChange events', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Textarea onChange={handleChange} />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test input');
      
      expect(handleChange).toHaveBeenCalled();
      // onChange called for each character typed
      expect(handleChange).toHaveBeenCalledTimes(10); // "Test input" = 10 characters
    });

    it('should work as controlled component', async () => {
      const user = userEvent.setup();
      const ControlledTextarea = () => {
        const [value, setValue] = React.useState('');
        return (
          <Textarea 
            value={value} 
            onChange={(e) => setValue(e.target.value)}
            data-testid="controlled-textarea"
          />
        );
      };
      
      render(<ControlledTextarea />);
      
      const textarea = screen.getByTestId('controlled-textarea');
      await user.type(textarea, 'Controlled text');
      
      expect(textarea).toHaveValue('Controlled text');
    });
  });

  describe('Form Integration', () => {
    it('should work with form submission', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault());
      
      render(
        <form onSubmit={handleSubmit}>
          <Textarea name="message" defaultValue="Form message" />
          <button type="submit">Submit</button>
        </form>
      );
      
      const form = screen.getByRole('textbox').closest('form');
      const formData = new FormData(form!);
      
      expect(formData.get('message')).toBe('Form message');
    });

    it('should handle required validation', () => {
      render(
        <form>
          <Textarea required name="required-field" />
          <button type="submit">Submit</button>
        </form>
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeRequired();
      expect(textarea).toBeInvalid(); // Empty required field
    });

    it('should work with labels', () => {
      render(
        <div>
          <label htmlFor="description">Description</label>
          <Textarea id="description" />
        </div>
      );
      
      const textarea = screen.getByLabelText('Description');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('should handle disabled state', () => {
      render(<Textarea disabled placeholder="Disabled textarea" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    it('should handle readonly state', async () => {
      const user = userEvent.setup();
      render(<Textarea readOnly defaultValue="Read only text" />);
      
      const textarea = screen.getByDisplayValue('Read only text');
      expect(textarea).toHaveAttribute('readonly');
      
      // Should not be able to type in readonly textarea
      await user.type(textarea, 'New text');
      expect(textarea).toHaveValue('Read only text');
    });

    it('should handle loading state with aria-busy', () => {
      render(<Textarea aria-busy="true" placeholder="Loading..." />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Styling', () => {
    it('should have default textarea styles', () => {
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass(
        'flex',
        'min-h-[80px]',
        'w-full',
        'rounded-md',
        'border',
        'border-input',
        'bg-background'
      );
    });

    it('should accept custom className', () => {
      render(<Textarea className="custom-textarea h-32" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('custom-textarea', 'h-32');
      // Should still have default classes
      expect(textarea).toHaveClass('min-h-[80px]', 'w-full');
    });

    it('should handle focus styles', async () => {
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
      
      await user.click(textarea);
      expect(textarea).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should support ARIA attributes', () => {
      render(
        <Textarea 
          aria-label="Message content"
          aria-describedby="message-help"
          aria-required="true"
        />
      );
      
      const textarea = screen.getByLabelText('Message content');
      expect(textarea).toHaveAttribute('aria-describedby', 'message-help');
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('should support aria-invalid for error states', () => {
      render(<Textarea aria-invalid="true" />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });

    it('should work with screen reader descriptions', () => {
      render(
        <div>
          <Textarea aria-describedby="help-text" />
          <div id="help-text">Maximum 500 characters</div>
        </div>
      );
      
      const textarea = screen.getByRole('textbox');
      const helpText = screen.getByText('Maximum 500 characters');
      
      expect(textarea).toHaveAttribute('aria-describedby', 'help-text');
      expect(helpText).toHaveAttribute('id', 'help-text');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable with Tab key', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <input type="text" data-testid="input" />
          <Textarea data-testid="textarea" />
        </div>
      );
      
      const input = screen.getByTestId('input');
      input.focus();
      
      await user.tab();
      const textarea = screen.getByTestId('textarea');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveFocus();
    });

    it('should handle keyboard input', async () => {
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('Line 1 and Line 2');
      
      expect(textarea).toHaveValue('Line 1 and Line 2');
    });
  });

  describe('Text Content Handling', () => {
    it('should handle long text content', async () => {
      const longText = 'A'.repeat(1000);
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, longText);
      
      expect(textarea).toHaveValue(longText);
    });

    it('should handle special characters', async () => {
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      const specialText = 'Special chars: @#$%^&*()_+-=';
      await user.type(textarea, specialText);
      
      expect(textarea).toHaveValue(specialText);
    });

    it('should handle emoji and unicode', async () => {
      const user = userEvent.setup();
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello 👋 World 🌍');
      
      expect(textarea).toHaveValue('Hello 👋 World 🌍');
    });
  });

  describe('Real-world Usage', () => {
    it('should work as comment input', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      
      render(
        <form onSubmit={handleSubmit}>
          <label htmlFor="comment">Comment</label>
          <Textarea 
            id="comment" 
            name="comment"
            placeholder="Write your comment..."
            rows={4}
          />
          <button type="submit">Post Comment</button>
        </form>
      );
      
      const textarea = screen.getByLabelText('Comment');
      await user.type(textarea, 'This is my comment on this post.');
      
      expect(textarea).toHaveValue('This is my comment on this post.');
    });

    it('should work as message composer', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <Textarea 
            placeholder="Type your message..."
            className="resize-none"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <button>Send</button>
          </div>
        </div>
      );
      
      const textarea = screen.getByPlaceholderText('Type your message...');
      await user.type(textarea, 'Hello! How are you doing today?');
      
      expect(textarea).toHaveValue('Hello! How are you doing today?');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty initial state', () => {
      render(<Textarea />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('should handle undefined props', () => {
      render(<Textarea {...{value: undefined, onChange: undefined}} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should handle rows attribute', () => {
      render(<Textarea rows={5} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });
  });
});