import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import type { ApiResponse } from '../lib/api-tests';

interface ResponseDisplayProps {
  response: ApiResponse | null;
  testName?: string;
}

export function ResponseDisplay({ response, testName }: ResponseDisplayProps) {
  const [activeTab, setActiveTab] = useState<'response' | 'headers'>('response');
  const [copied, setCopied] = useState(false);

  if (!response) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">No Response</div>
          <div className="text-sm">Run a test to see the response</div>
        </div>
      </div>
    );
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusBadgeVariant = (status: number) => {
    if (status === 0) return 'destructive';
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'default';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'destructive';
    return 'secondary';
  };

  const formatData = (data: any) => {
    if (data === null || data === undefined) {
      return 'null';
    }
    if (typeof data === 'string') {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {testName && <span className="font-medium">{testName}</span>}
            <Badge variant={getStatusBadgeVariant(response.status)}>
              {response.status} {response.statusText}
            </Badge>
          </div>
          <div className="text-sm text-gray-600">
            {response.responseTime}ms
          </div>
        </div>
        
        <div className="text-xs text-gray-500">
          {response.timestamp.toLocaleString()}
        </div>
      </div>

      {/* Error Alert */}
      {response.error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Network Error:</strong> {response.error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'response'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('response')}
          >
            Response
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'headers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('headers')}
          >
            Headers ({Object.keys(response.headers).length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'response' && (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-2 border-b bg-gray-50">
              <span className="text-sm font-medium">Response Body</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(formatData(response.data))}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                {formatData(response.data)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-2 border-b bg-gray-50">
              <span className="text-sm font-medium">Response Headers</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(JSON.stringify(response.headers, null, 2))}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-sm text-gray-700 min-w-0 flex-shrink-0">
                      {key}:
                    </span>
                    <span className="text-sm font-mono text-gray-600 break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}