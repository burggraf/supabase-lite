import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input with default type', () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render input with different types', () => {
      const types = ['text', 'password', 'email', 'number', 'tel', 'url'] as const;
      
      types.forEach((type) => {
        const { rerender } = render(<Input type={type} placeholder={`${type} input`} />);
        const input = screen.getByPlaceholderText(`${type} input`);
        expect(input).toHaveAttribute('type', type);
        rerender(<></>);
      });
    });

    it('should render disabled input', () => {
      render(<Input disabled placeholder="Disabled input" />);
      const input = screen.getByPlaceholderText('Disabled input');
      expect(input).toBeDisabled();
    });

    it('should render readonly input', () => {
      render(<Input readOnly value="readonly value" />);
      const input = screen.getByDisplayValue('readonly value');
      expect(input).toHaveAttribute('readonly');
    });

    it('should render input with default value', () => {
      render(<Input defaultValue="default text" />);
      const input = screen.getByDisplayValue('default text');
      expect(input).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Input onChange={handleChange} placeholder="Type here" />);
      const input = screen.getByPlaceholderText('Type here');
      
      await user.type(input, 'Hello World');
      expect(input).toHaveValue('Hello World');
      expect(handleChange).toHaveBeenCalled();
    });

    it('should handle focus and blur events', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      
      render(
        <Input
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Focus test"
        />
      );
      const input = screen.getByPlaceholderText('Focus test');
      
      await user.click(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
      
      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard events', async () => {
      const user = userEvent.setup();
      const handleKeyDown = vi.fn();
      
      render(<Input onKeyDown={handleKeyDown} placeholder="Key test" />);
      const input = screen.getByPlaceholderText('Key test');
      
      await user.click(input);
      await user.keyboard('{Enter}');
      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('should not accept input when disabled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      
      render(<Input disabled onChange={handleChange} placeholder="Disabled" />);
      const input = screen.getByPlaceholderText('Disabled');
      
      await user.type(input, 'test');
      expect(input).toHaveValue('');
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should support ARIA labels', () => {
      render(<Input aria-label="Username input" />);
      const input = screen.getByLabelText('Username input');
      expect(input).toBeInTheDocument();
    });

    it('should support ARIA describedby', () => {
      render(
        <div>
          <Input aria-describedby="help-text" placeholder="Input" />
          <div id="help-text">Help text</div>
        </div>
      );
      const input = screen.getByPlaceholderText('Input');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should support required attribute', () => {
      render(<Input required placeholder="Required input" />);
      const input = screen.getByPlaceholderText('Required input');
      expect(input).toBeRequired();
    });

    it('should support form association', () => {
      render(
        <form>
          <label htmlFor="test-input">Test Label</label>
          <Input id="test-input" />
        </form>
      );
      
      const input = screen.getByLabelText('Test Label');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'test-input');
    });
  });

  describe('Validation States', () => {
    it('should support pattern validation', () => {
      render(<Input pattern="[0-9]*" placeholder="Numbers only" />);
      const input = screen.getByPlaceholderText('Numbers only');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
    });

    it('should support min and max length', () => {
      render(<Input minLength={3} maxLength={10} placeholder="Length test" />);
      const input = screen.getByPlaceholderText('Length test');
      expect(input).toHaveAttribute('minlength', '3');
      expect(input).toHaveAttribute('maxlength', '10');
    });

    it('should support custom validation with form', () => {
      render(
        <form>
          <Input type="email" placeholder="Email" />
        </form>
      );
      
      const input = screen.getByPlaceholderText('Email');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('Custom Props', () => {
    it('should accept custom className', () => {
      render(<Input className="custom-input" placeholder="Custom" />);
      const input = screen.getByPlaceholderText('Custom');
      expect(input).toHaveClass('custom-input');
    });

    it('should accept custom data attributes', () => {
      render(<Input data-testid="custom-input" />);
      const input = screen.getByTestId('custom-input');
      expect(input).toBeInTheDocument();
    });

    it('should forward refs correctly', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });

    it('should support controlled components', () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('initial');
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="controlled-input"
          />
        );
      };

      render(<TestComponent />);
      const input = screen.getByTestId('controlled-input');
      expect(input).toHaveValue('initial');
    });
  });
});