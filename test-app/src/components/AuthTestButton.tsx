import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { executeAuthTest, getMethodColor } from '../lib/auth-tests';
import type { AuthTest, AuthResponse } from '../lib/auth-tests';

interface AuthState {
  isAuthenticated: boolean;
  user: any;
  session: any;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthTestButtonProps {
  test: AuthTest;
  onResponse: (testId: string, response: AuthResponse) => void;
  isLoading?: boolean;
  existingResponse?: AuthResponse;
  authState: AuthState;
}

export function AuthTestButton({ test, onResponse, isLoading = false, existingResponse, authState }: AuthTestButtonProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClick = async () => {
    setIsExecuting(true);
    try {
      const response = await executeAuthTest(test);
      onResponse(test.id, response);
    } catch (error) {
      console.error('Auth test execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const buttonVariant = getMethodColor(test.method) as any;

  const getStatusIndicator = () => {
    if (!existingResponse) return null;
    
    if (existingResponse.status >= 200 && existingResponse.status < 300) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">{existingResponse.status}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">{existingResponse.status || 'ERR'}</span>
        </div>
      );
    }
  };

  const getAuthRequirementIndicator = () => {
    if (test.adminOnly) {
      return (
        <Badge variant="secondary" className="text-xs">
          Admin + Auto-Auth
        </Badge>
      );
    }
    if (test.requiresAuth) {
      return (
        <Badge variant="secondary" className="text-xs">
          Auto-Auth
        </Badge>
      );
    }
    return null;
  };

  const isTestDisabled = () => {
    // No tests are disabled now - auto-auth handles authentication
    return false;
  };

  const getDisabledReason = () => {
    // No disabled reasons - auto-auth handles everything
    return null;
  };

  const disabled = isTestDisabled() || isExecuting || isLoading;
  const disabledReason = getDisabledReason();

  return (
    <div className={`flex flex-col gap-2 p-3 border rounded-lg transition-colors ${
      existingResponse ? 'bg-gray-25' : ''
    } hover:bg-gray-50`}>
      <div className="flex items-center gap-2">
        <Badge variant={buttonVariant}>
          {test.method}
        </Badge>
        <span className="font-medium text-sm flex-1">{test.name}</span>
        <div className="flex items-center gap-1">
          {getAuthRequirementIndicator()}
          {getStatusIndicator()}
        </div>
      </div>
      
      <p className="text-xs text-gray-600">{test.description}</p>
      
      <div className="space-y-2">
        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono block">
          {test.endpoint}
        </code>
        
        <Button
          size="sm"
          onClick={handleClick}
          disabled={isExecuting || isLoading}
          className="w-full"
        >
          {isExecuting ? 'Running...' : 'Test'}
        </Button>
      </div>
      
      {test.body && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Request Body
          </summary>
          <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
            {JSON.stringify(test.body, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}