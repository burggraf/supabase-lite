import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertDescription, AlertTitle } from '../alert';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

describe('Alert Component', () => {
  describe('Basic Alert', () => {
    it('should render alert with default variant', () => {
      render(
        <Alert>
          <AlertTitle>Alert Title</AlertTitle>
          <AlertDescription>Alert description</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert description')).toBeInTheDocument();
    });

    it('should render alert with only description', () => {
      render(
        <Alert>
          <AlertDescription>Simple alert message</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Simple alert message')).toBeInTheDocument();
    });

    it('should render alert with only title', () => {
      render(
        <Alert>
          <AlertTitle>Important Notice</AlertTitle>
        </Alert>
      );
      
      expect(screen.getByText('Important Notice')).toBeInTheDocument();
    });
  });

  describe('Alert Variants', () => {
    it('should render default variant alert', () => {
      render(
        <Alert variant="default">
          <AlertTitle>Default Alert</AlertTitle>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Default Alert')).toBeInTheDocument();
    });

    it('should render destructive variant alert', () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Error Alert</AlertTitle>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Error Alert')).toBeInTheDocument();
    });
  });

  describe('Alert with Icons', () => {
    it('should render alert with info icon', () => {
      render(
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>This is an informational message.</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Information')).toBeInTheDocument();
      expect(screen.getByText('This is an informational message.')).toBeInTheDocument();
    });

    it('should render alert with success icon', () => {
      render(
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Operation completed successfully.</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed successfully.')).toBeInTheDocument();
    });

    it('should render alert with warning icon', () => {
      render(
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>Please review your settings.</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Please review your settings.')).toBeInTheDocument();
    });

    it('should render alert with error icon', () => {
      render(
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong.</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    });
  });

  describe('Alert Structure', () => {
    it('should render complete alert structure', () => {
      render(
        <Alert>
          <AlertCircle className="h-4 w-4" data-testid="alert-icon" />
          <AlertTitle>Complete Alert</AlertTitle>
          <AlertDescription>
            This alert has all components: icon, title, and description.
          </AlertDescription>
        </Alert>
      );
      
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      expect(screen.getByText('Complete Alert')).toBeInTheDocument();
      expect(screen.getByText('This alert has all components: icon, title, and description.')).toBeInTheDocument();
    });

    it('should handle multiple alerts', () => {
      render(
        <div>
          <Alert>
            <AlertTitle>First Alert</AlertTitle>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Second Alert</AlertTitle>
          </Alert>
        </div>
      );
      
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
      expect(screen.getByText('First Alert')).toBeInTheDocument();
      expect(screen.getByText('Second Alert')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(
        <Alert>
          <AlertTitle>Accessible Alert</AlertTitle>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should handle custom ARIA attributes', () => {
      render(
        <Alert aria-label="Custom alert" aria-describedby="custom-desc">
          <AlertTitle>Custom Alert</AlertTitle>
          <AlertDescription id="custom-desc">Custom description</AlertDescription>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Custom alert');
      expect(alert).toHaveAttribute('aria-describedby', 'custom-desc');
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(
        <Alert className="custom-alert">
          <AlertTitle className="custom-title">Styled Alert</AlertTitle>
          <AlertDescription className="custom-description">Custom styles</AlertDescription>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-alert');
      
      const title = screen.getByText('Styled Alert');
      expect(title).toHaveClass('custom-title');
      
      const description = screen.getByText('Custom styles');
      expect(description).toHaveClass('custom-description');
    });

    it('should forward custom props', () => {
      render(
        <Alert data-testid="custom-alert" role="alert">
          <AlertTitle data-testid="custom-title">Test</AlertTitle>
          <AlertDescription data-testid="custom-desc">Description</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByTestId('custom-alert')).toBeInTheDocument();
      expect(screen.getByTestId('custom-title')).toBeInTheDocument();
      expect(screen.getByTestId('custom-desc')).toBeInTheDocument();
    });
  });

  describe('Content Variations', () => {
    it('should handle long content', () => {
      const longDescription = 'This is a very long alert description that might wrap to multiple lines and should be displayed properly within the alert component without breaking the layout or causing any visual issues.';
      
      render(
        <Alert>
          <AlertTitle>Long Content Alert</AlertTitle>
          <AlertDescription>{longDescription}</AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Long Content Alert')).toBeInTheDocument();
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should handle HTML content in description', () => {
      render(
        <Alert>
          <AlertTitle>Rich Content</AlertTitle>
          <AlertDescription>
            This alert contains <strong>bold text</strong> and{' '}
            <a href="#link">a link</a>.
          </AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Rich Content')).toBeInTheDocument();
      expect(screen.getByText('bold text')).toBeInTheDocument();
      expect(screen.getByText('a link')).toBeInTheDocument();
    });

    it('should handle empty content gracefully', () => {
      render(
        <Alert>
          <AlertTitle></AlertTitle>
          <AlertDescription></AlertDescription>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Real-world Usage Examples', () => {
    it('should render success notification', () => {
      render(
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Your changes have been saved successfully.
          </AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Your changes have been saved successfully.')).toBeInTheDocument();
    });

    it('should render error notification', () => {
      render(
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Unable to save changes. Please try again.
          </AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Unable to save changes. Please try again.')).toBeInTheDocument();
    });

    it('should render informational alert', () => {
      render(
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Update Available</AlertTitle>
          <AlertDescription>
            A new version of the application is available.{' '}
            <button className="underline">Update now</button>
          </AlertDescription>
        </Alert>
      );
      
      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.getByText('A new version of the application is available.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update now' })).toBeInTheDocument();
    });
  });
});