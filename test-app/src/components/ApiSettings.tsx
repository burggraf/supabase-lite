import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { setBaseUrl, getBaseUrl } from '../lib/api-tests';
import { updateSupabaseClient } from '../lib/supabase';

interface ApiSettingsProps {
  onSettingsChange: () => void;
}

// Storage keys for persisting settings
const SUPABASE_URL_KEY = 'supabase-lite-url';
const SUPABASE_API_KEY_KEY = 'supabase-lite-api-key';
const URL_MODE_KEY = 'supabase-lite-url-mode';

type UrlMode = 'port' | 'custom' | 'origin';

export function ApiSettings({ onSettingsChange }: ApiSettingsProps) {
  const [urlMode, setUrlMode] = useState<UrlMode>('port');
  const [port, setPort] = useState('5173');
  const [customUrl, setCustomUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  const [appliedSuccessfully, setAppliedSuccessfully] = useState(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedUrlMode = localStorage.getItem(URL_MODE_KEY) as UrlMode || 'port';
    const savedUrl = localStorage.getItem(SUPABASE_URL_KEY);
    const savedApiKey = localStorage.getItem(SUPABASE_API_KEY_KEY);
    
    setUrlMode(savedUrlMode);
    
    if (savedUrl) {
      if (savedUrlMode === 'port') {
        const urlMatch = savedUrl.match(/localhost:(\d+)/);
        if (urlMatch) {
          setPort(urlMatch[1]);
        }
      } else if (savedUrlMode === 'custom') {
        setCustomUrl(savedUrl);
      }
      setBaseUrl(savedUrl);
    } else {
      // Initialize with current base URL as fallback
      const currentUrl = getBaseUrl();
      const urlMatch = currentUrl.match(/localhost:(\d+)/);
      if (urlMatch) {
        setPort(urlMatch[1]);
      }
    }
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  const validatePort = (portValue: string): boolean => {
    const portNum = parseInt(portValue);
    return !isNaN(portNum) && portNum >= 1000 && portNum <= 65535;
  };
  
  const validateUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  const getCurrentUrl = (): string => {
    switch (urlMode) {
      case 'port':
        return `http://localhost:${port}`;
      case 'custom':
        return customUrl;
      case 'origin':
        return window.location.origin;
      default:
        return '';
    }
  };
  
  const isCurrentConfigValid = (): boolean => {
    switch (urlMode) {
      case 'port':
        return validatePort(port);
      case 'custom':
        return validateUrl(customUrl);
      case 'origin':
        return true; // Always valid
      default:
        return false;
    }
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPort = e.target.value;
    setPort(newPort);
    setConnectionStatus('unknown');
  };
  
  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setCustomUrl(newUrl);
    setConnectionStatus('unknown');
  };
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };
  
  const handleUrlModeChange = (mode: UrlMode) => {
    setUrlMode(mode);
    setConnectionStatus('unknown');
  };

  const testConnection = async () => {
    if (!isCurrentConfigValid()) return;

    setIsConnecting(true);
    setConnectionStatus('unknown');
    setErrorMessage('');

    const testUrl = getCurrentUrl();
    
    try {
      // For custom URLs, test the health endpoint. For local/origin, test the root endpoint
      const testEndpoint = urlMode === 'custom' ? '/health' : '/';
      const response = await fetch(`${testUrl}${testEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` })
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        if (testEndpoint === '/health') {
          // For Supabase health endpoints, parse JSON response
          const responseData = await response.json().catch(() => ({}));
          
          if (responseData.error && responseData.message?.includes('database not connected')) {
            setConnectionStatus('connected');
            setErrorMessage('Server running (database requires browser connection)');
          } else {
            setConnectionStatus('connected');
            setErrorMessage('');
          }
        } else {
          // For root endpoints, just check if we got a response
          setConnectionStatus('connected');
          setErrorMessage('');
        }
        
        setBaseUrl(testUrl);
        onSettingsChange();
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
    if (!isCurrentConfigValid()) return;
    
    const newBaseUrl = getCurrentUrl();
    setBaseUrl(newBaseUrl);
    
    // Save settings to localStorage
    localStorage.setItem(URL_MODE_KEY, urlMode);
    localStorage.setItem(SUPABASE_URL_KEY, newBaseUrl);
    if (apiKey) {
      localStorage.setItem(SUPABASE_API_KEY_KEY, apiKey);
    }
    
    // Update Supabase client with new configuration
    updateSupabaseClient(newBaseUrl, apiKey);
    
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
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Supabase Configuration</h3>
      
      <div className="space-y-6">
        {/* URL Configuration Mode */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Supabase URL Configuration
          </Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="port-mode"
                name="url-mode"
                value="port"
                checked={urlMode === 'port'}
                onChange={() => handleUrlModeChange('port')}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="port-mode" className="text-sm">Local development (localhost:port)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="custom-mode"
                name="url-mode"
                value="custom"
                checked={urlMode === 'custom'}
                onChange={() => handleUrlModeChange('custom')}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="custom-mode" className="text-sm">Custom URL</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="origin-mode"
                name="url-mode"
                value="origin"
                checked={urlMode === 'origin'}
                onChange={() => handleUrlModeChange('origin')}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="origin-mode" className="text-sm">Use current domain (for hosted deployments)</Label>
            </div>
          </div>
        </div>

        {/* URL Input Based on Mode */}
        {urlMode === 'port' && (
          <div>
            <Label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
              Server Port
            </Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                http://localhost:
              </span>
              <Input
                type="number"
                id="port"
                value={port}
                onChange={handlePortChange}
                className={`rounded-none rounded-r-md ${
                  urlMode === 'port' && !validatePort(port) ? 'border-red-300 bg-red-50' : ''
                }`}
                placeholder="5173"
                min="1000"
                max="65535"
              />
            </div>
            {urlMode === 'port' && !validatePort(port) && (
              <p className="mt-1 text-xs text-red-600">Port must be between 1000 and 65535</p>
            )}
          </div>
        )}

        {urlMode === 'custom' && (
          <div>
            <Label htmlFor="custom-url" className="block text-sm font-medium text-gray-700 mb-1">
              Supabase URL
            </Label>
            <Input
              type="url"
              id="custom-url"
              value={customUrl}
              onChange={handleCustomUrlChange}
              className={urlMode === 'custom' && !validateUrl(customUrl) ? 'border-red-300 bg-red-50' : ''}
              placeholder="https://your-project.supabase.co"
            />
            {urlMode === 'custom' && customUrl && !validateUrl(customUrl) && (
              <p className="mt-1 text-xs text-red-600">Please enter a valid URL</p>
            )}
          </div>
        )}

        {urlMode === 'origin' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>Current domain will be used:</strong> {window.location.origin}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Perfect for hosted deployments on supabase-lite.com or custom domains
            </div>
          </div>
        )}

        {/* API Key */}
        <div>
          <Label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
            Supabase API Key (anon key)
          </Label>
          <Input
            type="password"
            id="api-key"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your project's anonymous/public API key from Supabase dashboard
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={testConnection}
            disabled={!isCurrentConfigValid() || isConnecting}
            className="flex items-center gap-1"
          >
            {isConnecting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              getStatusIcon()
            )}
            {isConnecting ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <Button
            size="sm"
            onClick={applySettings}
            disabled={!isCurrentConfigValid()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Apply Settings
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

        {/* Connection Status */}
        {connectionStatus !== 'unknown' && (
          <div className="text-xs">
            {connectionStatus === 'connected' ? (
              <div className="flex items-center gap-1 text-green-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {errorMessage || 'Connected to Supabase server'}
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

        {/* Current Configuration */}
        <div className="text-xs text-gray-500 space-y-1">
          <div><strong>Current URL:</strong> {getCurrentUrl()}</div>
          {apiKey && <div><strong>API Key:</strong> {apiKey.substring(0, 20)}...</div>}
        </div>

        {/* Usage Hints */}
        <Alert className="">
          <AlertDescription className="text-xs">
            <strong>Setup options:</strong>
            <ul className="mt-1 space-y-1">
              <li>• <strong>Local:</strong> Connect to local Supabase Lite (port 5173)</li>
              <li>• <strong>Custom:</strong> Connect to any Supabase project or compatible API</li>
              <li>• <strong>Current domain:</strong> Automatically use the same domain as this app</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}