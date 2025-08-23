import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { setBaseUrl, getBaseUrl } from '../lib/api-tests';

interface ApiSettingsProps {
  onSettingsChange: () => void;
}

// Storage key for persisting port setting
const PORT_STORAGE_KEY = 'supabase-lite-test-port';

export function ApiSettings({ onSettingsChange }: ApiSettingsProps) {
  const [port, setPort] = useState('5173');
  const [isValid, setIsValid] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);

  useEffect(() => {
    // Load saved port from localStorage or use default
    const savedPort = localStorage.getItem(PORT_STORAGE_KEY);
    if (savedPort && validatePort(savedPort)) {
      setPort(savedPort);
      // Update the base URL with the saved port
      setBaseUrl(`http://localhost:${savedPort}`);
    } else {
      // Initialize with current base URL as fallback
      const currentUrl = getBaseUrl();
      const urlMatch = currentUrl.match(/localhost:(\d+)/);
      if (urlMatch) {
        setPort(urlMatch[1]);
      }
    }
  }, []);

  const validatePort = (portValue: string): boolean => {
    const portNum = parseInt(portValue);
    return !isNaN(portNum) && portNum >= 1000 && portNum <= 65535;
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPort = e.target.value;
    setPort(newPort);
    setIsValid(validatePort(newPort));
    setConnectionStatus('unknown');
  };

  const testConnection = async () => {
    if (!isValid) return;

    setIsConnecting(true);
    setConnectionStatus('unknown');
    setErrorMessage('');

    const testUrl = `http://localhost:${port}`;
    
    try {
      // Test the health endpoint
      const response = await fetch(`${testUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        setConnectionStatus('connected');
        setBaseUrl(testUrl);
        
        // Save successful port to localStorage
        localStorage.setItem(PORT_STORAGE_KEY, port);
        
        onSettingsChange();
        setErrorMessage('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setConnectionStatus('error');
        setErrorMessage(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          setErrorMessage('Connection timeout - server may not be running');
        } else if (error.message.includes('fetch')) {
          setErrorMessage('Connection failed - check if server is running');
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage('Unknown connection error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const applySettings = () => {
    if (!isValid) return;
    
    const newBaseUrl = `http://localhost:${port}`;
    setBaseUrl(newBaseUrl);
    
    // Save port to localStorage
    localStorage.setItem(PORT_STORAGE_KEY, port);
    
    // Show success feedback
    setAppliedSuccessfully(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setAppliedSuccessfully(false);
    }, 3000);
    
    onSettingsChange();
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">API Server Settings</h3>
      
      <div className="space-y-3">
        <div>
          <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
            Server Port
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  http://localhost:
                </span>
                <input
                  type="number"
                  id="port"
                  value={port}
                  onChange={handlePortChange}
                  className={`flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !isValid ? 'border-red-300 bg-red-50' : ''
                  }`}
                  placeholder="5175"
                  min="1000"
                  max="65535"
                />
              </div>
              {!isValid && (
                <p className="mt-1 text-xs text-red-600">Port must be between 1000 and 65535</p>
              )}
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={testConnection}
              disabled={!isValid || isConnecting}
              className="flex items-center gap-1"
            >
              {isConnecting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                getStatusIcon()
              )}
              {isConnecting ? 'Testing...' : 'Test'}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={applySettings}
                disabled={!isValid}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply
              </Button>
              
              {appliedSuccessfully && (
                <div className="flex items-center gap-1 text-green-600 text-sm animate-in fade-in duration-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Settings saved!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {connectionStatus !== 'unknown' && (
          <div className="text-xs">
            {connectionStatus === 'connected' ? (
              <div className="flex items-center gap-1 text-green-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Connected to Supabase Lite server
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Connection failed: {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Current API URL */}
        <div className="text-xs text-gray-500">
          <strong>Current API URL:</strong> {getBaseUrl()}
        </div>
      </div>

      {/* Usage Hints */}
      <div className="space-y-2 mt-4">
        <Alert className="">
          <AlertDescription className="text-xs">
            <strong>Common ports:</strong> 5173 (default Vite), 5175, 3000 (Next.js), 8000 (Python)
          </AlertDescription>
        </Alert>
        
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Tip:</strong> Your port setting is automatically saved and will be remembered across sessions.
        </div>
      </div>
    </div>
  );
}