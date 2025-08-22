import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getBaseUrl } from '../lib/api-tests';
import type { ApiTest } from '../lib/api-tests';

interface RequestDetailsProps {
  test: ApiTest | null;
}

export function RequestDetails({ test }: RequestDetailsProps) {
  const [copied, setCopied] = useState(false);

  if (!test) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium">No Request Selected</div>
          <div className="text-sm">Click a test button to see request details</div>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const curlCommand = generateCurlCommand(test);
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateCurlCommand = (test: ApiTest): string => {
    const baseUrl = getBaseUrl();
    let curl = `curl -X ${test.method} "${baseUrl}${test.endpoint}"`;
    
    // Add headers
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -H "Accept: application/json"`;
    curl += ` \\\n  -H "apikey: test-api-key"`;
    
    // Add body if present
    if (test.body && (test.method === 'POST' || test.method === 'PATCH')) {
      curl += ` \\\n  -d '${JSON.stringify(test.body)}'`;
    }
    
    return curl;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant={test.method === 'GET' ? 'success' : 
                           test.method === 'POST' ? 'default' :
                           test.method === 'PATCH' ? 'warning' : 'destructive'}>
              {test.method}
            </Badge>
            <span className="font-medium">{test.name}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy cURL'}
          </Button>
        </div>
        <p className="text-sm text-gray-600">{test.description}</p>
      </div>

      {/* Request Details */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* URL */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Request URL</h3>
            <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
              <span className="text-blue-600">{test.method}</span>{' '}
              <span>{getBaseUrl()}{test.endpoint}</span>
            </div>
          </div>

          {/* Headers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Headers</h3>
            <div className="bg-gray-100 p-3 rounded space-y-1">
              <div className="text-sm font-mono">
                <span className="text-gray-600">Content-Type:</span> application/json
              </div>
              <div className="text-sm font-mono">
                <span className="text-gray-600">Accept:</span> application/json
              </div>
              <div className="text-sm font-mono">
                <span className="text-gray-600">apikey:</span> test-api-key
              </div>
            </div>
          </div>

          {/* Request Body */}
          {test.body && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Body</h3>
              <div className="bg-gray-100 p-3 rounded">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {JSON.stringify(test.body, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* cURL Command */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">cURL Command</h3>
            <div className="bg-gray-900 text-green-400 p-3 rounded">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {generateCurlCommand(test)}
              </pre>
            </div>
          </div>

          {/* Query Parameters Breakdown */}
          {test.endpoint.includes('?') && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Query Parameters</h3>
              <div className="bg-gray-100 p-3 rounded">
                {test.endpoint.split('?')[1].split('&').map((param, index) => {
                  const [key, value] = param.split('=');
                  return (
                    <div key={index} className="text-sm font-mono mb-1">
                      <span className="text-blue-600">{decodeURIComponent(key)}</span>
                      {value && (
                        <>
                          <span className="text-gray-500"> = </span>
                          <span className="text-green-600">{decodeURIComponent(value)}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}