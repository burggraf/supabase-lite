import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { executeApiTest, getMethodColor } from '../lib/api-tests';
import type { ApiTest, ApiResponse } from '../lib/api-tests';

interface TestButtonProps {
  test: ApiTest;
  onResponse: (testId: string, response: ApiResponse) => void;
  isLoading?: boolean;
  existingResponse?: ApiResponse;
}

export function TestButton({ test, onResponse, isLoading = false, existingResponse }: TestButtonProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClick = async () => {
    setIsExecuting(true);
    try {
      const response = await executeApiTest(test);
      onResponse(test.id, response);
    } catch (error) {
      console.error('Test execution failed:', error);
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

  return (
    <div className={`flex flex-col gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
      existingResponse ? 'bg-gray-25' : ''
    }`}>
      <div className="flex items-center gap-2">
        <Badge variant={buttonVariant}>
          {test.method}
        </Badge>
        <span className="font-medium text-sm flex-1">{test.name}</span>
        {getStatusIndicator()}
      </div>
      
      <p className="text-xs text-gray-600">{test.description}</p>
      
      <div className="flex items-center justify-between">
        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
          {test.endpoint}
        </code>
        
        <Button
          size="sm"
          onClick={handleClick}
          disabled={isExecuting || isLoading}
          className="ml-2"
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