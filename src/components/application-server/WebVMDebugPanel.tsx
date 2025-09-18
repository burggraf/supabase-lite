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
      // Try to access WebVMManager
      const response = await fetch('/api/debug/webvm/status');
      const data = await response.json();
      
      // Try to access the actual WebVM system
      let actualState: WebVMState = {
        initialized: false,
        providerType: 'unknown',
        runtimeCount: 0,
        activeRuntimes: [],
        systemStats: null,
        lastError: null,
        providerFallbackAttempted: false
      };

      // Check if WebVM classes are available globally
      if (typeof window !== 'undefined') {
        try {
          // Try to import and check WebVMManager
          const { WebVMManager } = await import('../../lib/webvm/WebVMManager');
          
          // Check if we can get an instance (this will tell us if it's initialized)
          try {
            const manager = WebVMManager.getInstance({
              type: 'mock',
              mock: { simulateLatency: false }
            });
            
            const systemStatus = await manager.getSystemStatus();
            const metrics = manager.getSystemMetrics();
            
            actualState = {
              initialized: systemStatus.initialized,
              providerType: systemStatus.providerType as any,
              runtimeCount: systemStatus.runtimeCount,
              activeRuntimes: await manager.listRuntimes(),
              systemStats: systemStatus.stats,
              lastError: null,
              providerFallbackAttempted: metrics.webvm.providerFallbackAttempted
            };
            
            addDebugLog('info', 'WebVMManager accessible and responding', { systemStatus, metrics });
          } catch (managerError) {
            actualState.lastError = `WebVMManager error: ${managerError.message}`;
            addDebugLog('error', 'WebVMManager not accessible', { error: managerError });
          }
        } catch (importError) {
          actualState.lastError = `Import error: ${importError.message}`;
          addDebugLog('error', 'Failed to import WebVMManager', { error: importError });
        }
      }

      setWebvmState(actualState);
      
    } catch (error) {
      addDebugLog('error', 'Failed to check WebVM system', { error });
      setWebvmState(prev => ({
        ...prev,
        lastError: `Check failed: ${error.message}`
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
    addDebugLog('info', 'Starting WebVM operation tests');
    
    try {
      // Test 1: Try to initialize WebVM
      addDebugLog('debug', 'Test 1: Attempting WebVM initialization');
      const { WebVMManager } = await import('../../lib/webvm/WebVMManager');
      
      const manager = WebVMManager.getInstance({
        type: 'cheerpx', // Try real provider first
        webvm: {
          diskImage: 'https://disks.webvm.io/debian_large_20230522_5044875776.ext2',
          persistent: true,
          memorySize: 256
        }
      });

      await manager.initialize();
      addDebugLog('info', 'WebVM initialized successfully with CheerpX provider');
      
      // Test 2: Try to start a runtime
      addDebugLog('debug', 'Test 2: Attempting to start Node.js runtime');
      const runtime = await manager.startRuntime('node', '20', {
        appId: 'debug-test-app',
        autoRestart: false
      });
      
      addDebugLog('info', 'Runtime started successfully', { runtime });
      
      // Test 3: Try to execute a command
      addDebugLog('debug', 'Test 3: Executing test command');
      const result = await manager.executeCommand(runtime.id, 'echo "Hello from WebVM!"');
      addDebugLog('info', 'Command executed', { result });
      
      // Test 4: Try HTTP proxy
      addDebugLog('debug', 'Test 4: Testing HTTP proxy capabilities');
      const testRequest = new Request('http://localhost:3000/test', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const proxyResponse = await manager.proxyHTTPRequest(runtime.id, testRequest);
      addDebugLog('info', 'HTTP proxy test completed', { 
        status: proxyResponse.status,
        body: await proxyResponse.text()
      });
      
      // Clean up
      await manager.stopRuntime(runtime.id);
      addDebugLog('info', 'Test runtime stopped');
      
    } catch (error) {
      addDebugLog('error', 'WebVM operation test failed', { error });
      
      // If CheerpX failed, try with mock provider
      try {
        addDebugLog('warn', 'CheerpX failed, trying mock provider');
        const { WebVMManager } = await import('../../lib/webvm/WebVMManager');
        
        const mockManager = WebVMManager.getInstance({
          type: 'mock',
          mock: {
            simulateLatency: true,
            minLatency: 10,
            maxLatency: 50,
            errorRate: 0
          }
        });

        await mockManager.initialize();
        addDebugLog('info', 'Mock WebVM provider initialized successfully');
        
        const mockRuntime = await mockManager.startRuntime('node', '20', {
          appId: 'mock-test-app',
          autoRestart: false
        });
        
        addDebugLog('info', 'Mock runtime started', { mockRuntime });
        
        await mockManager.stopRuntime(mockRuntime.id);
        addDebugLog('info', 'Mock runtime stopped');
        
      } catch (mockError) {
        addDebugLog('error', 'Even mock provider failed', { error: mockError });
      }
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