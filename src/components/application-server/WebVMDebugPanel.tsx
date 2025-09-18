/**
 * WebVM Debug Panel - Shows real WebVM state and operations
 * Provides transparency into what's actually happening vs mocked
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface WebVMState {
  initialized: boolean;
  providerType: 'mock' | 'cheerpx' | 'unknown';
  runtimeCount: number;
  activeRuntimes: any[];
  systemStats: any;
  lastError: string | null;
  providerFallbackAttempted: boolean;
}

interface DebugLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export function WebVMDebugPanel() {
  const [webvmState, setWebvmState] = useState<WebVMState>({
    initialized: false,
    providerType: 'unknown',
    runtimeCount: 0,
    activeRuntimes: [],
    systemStats: null,
    lastError: null,
    providerFallbackAttempted: false
  });
  
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [isCollectingLogs, setIsCollectingLogs] = useState(false);

  // Check if WebVM system exists
  const checkWebVMSystem = async () => {
    try {
      addDebugLog('debug', 'Checking WebVM system via API');
      
      // Get WebVM status via API (safer than direct imports)
      const [webvmResponse, applicationServerResponse] = await Promise.all([
        fetch('/api/debug/webvm/status').catch(err => ({ ok: false, statusText: err.message })),
        fetch('/api/application-server/status').catch(err => ({ ok: false, statusText: err.message }))
      ]);

      let actualState: WebVMState = {
        initialized: false,
        providerType: 'unknown',
        runtimeCount: 0,
        activeRuntimes: [],
        systemStats: null,
        lastError: null,
        providerFallbackAttempted: false
      };

      if (webvmResponse.ok) {
        const webvmData = await webvmResponse.json();
        addDebugLog('info', 'WebVM API responded successfully', { webvmData });
        
        actualState = {
          initialized: webvmData.initialized || false,
          providerType: webvmData.providerType || 'unknown',
          runtimeCount: webvmData.runtimeCount || 0,
          activeRuntimes: [], // Will be fetched separately if needed
          systemStats: webvmData.stats || null,
          lastError: null,
          providerFallbackAttempted: webvmData.metrics?.webvm?.providerFallbackAttempted || false
        };
      } else {
        const errorMsg = `WebVM API error: ${webvmResponse.statusText}`;
        actualState.lastError = errorMsg;
        addDebugLog('error', errorMsg);
      }

      if (applicationServerResponse.ok) {
        const appServerData = await applicationServerResponse.json();
        addDebugLog('info', 'Application Server API responded successfully', { appServerData });
        
        // Merge application server data
        if (appServerData.webvm) {
          actualState.initialized = appServerData.webvm.initialized || actualState.initialized;
          actualState.providerType = appServerData.webvm.providerType || actualState.providerType;
          actualState.runtimeCount = appServerData.webvm.runtimeCount || actualState.runtimeCount;
        }
      } else {
        addDebugLog('warn', `Application Server API error: ${applicationServerResponse.statusText}`);
      }

      setWebvmState(actualState);
      
    } catch (error) {
      const errorMsg = `System check failed: ${error.message}`;
      addDebugLog('error', errorMsg, { error });
      setWebvmState(prev => ({
        ...prev,
        lastError: errorMsg
      }));
    }
  };

  const addDebugLog = (level: DebugLogEntry['level'], message: string, data?: any) => {
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    setDebugLogs(prev => [entry, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const testWebVMOperations = async () => {
    addDebugLog('info', 'Starting WebVM API tests');
    
    try {
      // Test 1: Check API endpoints
      addDebugLog('debug', 'Test 1: Testing API endpoints');
      
      const endpoints = [
        '/api/debug/webvm/status',
        '/api/webvm/status', 
        '/api/application-server/status',
        '/api/applications',
        '/api/runtimes'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            addDebugLog('info', `✅ ${endpoint} - OK`, { status: response.status, dataKeys: Object.keys(data) });
          } else {
            addDebugLog('warn', `⚠️ ${endpoint} - ${response.status}`, { status: response.status, statusText: response.statusText });
          }
        } catch (endpointError) {
          addDebugLog('error', `❌ ${endpoint} - Failed`, { error: endpointError.message });
        }
      }
      
      // Test 2: Try to create a test application
      addDebugLog('debug', 'Test 2: Testing application creation');
      try {
        const testApp = {
          id: `debug-test-${Date.now()}`,
          name: 'Debug Test App',
          description: 'Test application for WebVM debugging',
          runtimeId: 'static',
          metadata: {
            files: [{
              name: 'index.html',
              content: '<html><body><h1>Debug Test</h1></body></html>',
              size: 50
            }]
          }
        };
        
        const createResponse = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testApp)
        });
        
        if (createResponse.ok) {
          const createdApp = await createResponse.json();
          addDebugLog('info', 'Test application created successfully', { app: createdApp });
          
          // Clean up - try to delete the test app
          try {
            const deleteResponse = await fetch(`/api/applications/${testApp.id}`, {
              method: 'DELETE'
            });
            if (deleteResponse.ok) {
              addDebugLog('info', 'Test application cleaned up successfully');
            }
          } catch (cleanupError) {
            addDebugLog('warn', 'Failed to clean up test application', { error: cleanupError.message });
          }
        } else {
          addDebugLog('warn', 'Failed to create test application', { 
            status: createResponse.status, 
            statusText: createResponse.statusText 
          });
        }
      } catch (appError) {
        addDebugLog('error', 'Application test failed', { error: appError.message });
      }
      
      // Test 3: Test WebVM status monitoring
      addDebugLog('debug', 'Test 3: Testing WebVM status monitoring');
      try {
        const statusResponse = await fetch('/api/debug/webvm/status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          addDebugLog('info', 'WebVM status monitoring working', { 
            provider: statusData.provider,
            initialized: statusData.initialized,
            runtimeCount: statusData.runtimeCount
          });
        }
      } catch (statusError) {
        addDebugLog('error', 'WebVM status monitoring failed', { error: statusError.message });
      }
      
    } catch (error) {
      addDebugLog('error', 'WebVM API tests failed', { error: error.message });
    }
    
    // Refresh state after tests
    await checkWebVMSystem();
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  const toggleLogCollection = () => {
    setIsCollectingLogs(!isCollectingLogs);
    if (!isCollectingLogs) {
      addDebugLog('info', 'Log collection enabled');
    } else {
      addDebugLog('info', 'Log collection disabled');
    }
  };

  const getLevelColor = (level: DebugLogEntry['level']) => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': return 'default';
      case 'debug': return 'outline';
      default: return 'default';
    }
  };

  useEffect(() => {
    checkWebVMSystem();
    
    // Set up periodic state checking
    const interval = setInterval(checkWebVMSystem, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            WebVM System Debug Panel
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkWebVMSystem}
              >
                Refresh State
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testWebVMOperations}
              >
                Run Tests
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="state" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="state">System State</TabsTrigger>
              <TabsTrigger value="runtimes">Active Runtimes</TabsTrigger>
              <TabsTrigger value="logs">Debug Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="state" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">WebVM Status</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Initialized:</span>
                      <Badge variant={webvmState.initialized ? "default" : "destructive"}>
                        {webvmState.initialized ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Provider:</span>
                      <Badge variant={webvmState.providerType === 'mock' ? "secondary" : "default"}>
                        {webvmState.providerType}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Runtime Count:</span>
                      <Badge variant="outline">{webvmState.runtimeCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Fallback Attempted:</span>
                      <Badge variant={webvmState.providerFallbackAttempted ? "secondary" : "outline"}>
                        {webvmState.providerFallbackAttempted ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Error Status</h4>
                  {webvmState.lastError ? (
                    <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      {webvmState.lastError}
                    </div>
                  ) : (
                    <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      No errors detected
                    </div>
                  )}
                </div>
              </div>
              
              {webvmState.systemStats && (
                <div className="space-y-2">
                  <h4 className="font-medium">System Statistics</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(webvmState.systemStats, null, 2)}
                  </pre>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="runtimes" className="space-y-4">
              {webvmState.activeRuntimes.length > 0 ? (
                <div className="space-y-2">
                  {webvmState.activeRuntimes.map((runtime, index) => (
                    <div key={runtime.id || index} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium">{runtime.id}</h5>
                          <p className="text-sm text-muted-foreground">
                            {runtime.type} v{runtime.version}
                          </p>
                        </div>
                        <Badge variant={runtime.status === 'running' ? 'default' : 'secondary'}>
                          {runtime.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        App: {runtime.metadata?.appId || 'N/A'} | 
                        Started: {new Date(runtime.startTime).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No active runtimes detected
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="logs" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Debug Logs ({debugLogs.length})</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleLogCollection}
                  >
                    {isCollectingLogs ? 'Stop' : 'Start'} Collection
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearLogs}
                  >
                    Clear Logs
                  </Button>
                </div>
              </div>
              
              <div className="space-y-1 max-h-96 overflow-auto">
                {debugLogs.map((log, index) => (
                  <div key={index} className="p-2 border-l-2 border-muted bg-muted/30">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={getLevelColor(log.level)} className="text-xs">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm mt-1">{log.message}</div>
                    {log.data && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                
                {debugLogs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No debug logs yet. Click "Run Tests" to generate some logs.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}