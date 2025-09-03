/**
 * Offline Error Boundary Component
 * Provides graceful error handling with offline-specific messaging and recovery
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OfflineErrorHandler, type ErrorContext } from '@/lib/offline/OfflineErrorHandler';

interface OfflineErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  operationName?: string;
  offlineMessage?: string;
  fallbackMessage?: string;
  enableAutoRetry?: boolean;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isOfflineError: boolean;
  userFriendlyMessage: string;
  suggestedActions: string[];
}

export class OfflineErrorBoundary extends React.Component<
  OfflineErrorBoundaryProps,
  OfflineErrorBoundaryState
> {
  private errorHandler: OfflineErrorHandler;

  constructor(props: OfflineErrorBoundaryProps) {
    super(props);
    this.errorHandler = OfflineErrorHandler.getInstance();
    this.state = {
      hasError: false,
      error: null,
      isOfflineError: false,
      userFriendlyMessage: '',
      suggestedActions: []
    };
  }

  static getDerivedStateFromError(error: Error): Partial<OfflineErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context: ErrorContext = {
      operation: this.props.operationName || 'error_boundary',
      component: 'OfflineErrorBoundary',
      userAction: 'Render component'
    };

    const enrichedError = this.errorHandler.enrichError(error, context);

    this.setState({
      isOfflineError: enrichedError.isOffline,
      userFriendlyMessage: enrichedError.userFriendlyMessage,
      suggestedActions: enrichedError.suggestedActions
    });

    // Schedule automatic retry if enabled and error is offline-related
    if (this.props.enableAutoRetry && enrichedError.isOffline && this.props.onRetry) {
      this.errorHandler.scheduleRetry(error, context, () => {
        this.handleRetry();
      });
    }

    // Log error for monitoring (non-PII)
    console.error('OfflineErrorBoundary caught error:', {
      operation: context.operation,
      component: context.component,
      isOffline: enrichedError.isOffline,
      timestamp: new Date().toISOString()
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      isOfflineError: false,
      userFriendlyMessage: '',
      suggestedActions: []
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isOfflineError, userFriendlyMessage, suggestedActions } = this.state;
    const { offlineMessage, fallbackMessage } = this.props;

    // Determine display message
    const displayMessage = isOfflineError 
      ? (offlineMessage || userFriendlyMessage)
      : (fallbackMessage || userFriendlyMessage);

    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {isOfflineError ? (
                <>
                  <WifiOff className="w-6 h-6 text-orange-500" />
                  Connection Issue
                  <Badge variant="secondary">Offline</Badge>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  Something went wrong
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Message */}
            <div className="text-center text-muted-foreground">
              {displayMessage}
            </div>

            {/* Suggested Actions */}
            {suggestedActions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  What you can do:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {suggestedActions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={this.handleRetry}
                variant={isOfflineError ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>

            {/* Technical Details (Development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Technical Details
                </summary>
                <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                  <div><strong>Error:</strong> {this.state.error.message}</div>
                  {this.state.error.stack && (
                    <div className="mt-1">
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}