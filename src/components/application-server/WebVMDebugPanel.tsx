/**
 * WebVM Debug Panel - Shows real WebVM state and operations
 * Provides transparency into what's actually happening vs mocked
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
// Dynamic imports for xterm.js to handle loading errors gracefully
// import { Terminal } from '@xterm/xterm';
// import { FitAddon } from '@xterm/addon-fit';
// import { WebLinksAddon } from '@xterm/addon-web-links';
// import '@xterm/xterm/css/xterm.css';

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
  
  // Terminal state
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<any>(null);
  const fitAddon = useRef<any>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

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

  // Initialize terminal - Skip xterm.js and go directly to fallback
  const initializeTerminal = async () => {
    if (!terminalRef.current || terminalInstance.current) return;

    addDebugLog('debug', 'Starting terminal initialization (fallback mode)...');
    
    // Skip xterm.js entirely due to module resolution issues
    // Go directly to working fallback terminal
    createFallbackTerminal();
  };

  // Fallback terminal interface - working HTML/CSS terminal
  const createFallbackTerminal = () => {
    if (!terminalRef.current) {
      addDebugLog('error', 'Terminal ref not available');
      return;
    }
    
    addDebugLog('debug', 'Creating fallback terminal interface...');
    
    terminalRef.current.innerHTML = `
      <div id="fallback-terminal" style="
        background: #1e1e1e;
        color: #ffffff;
        font-family: Monaco, Menlo, 'Ubuntu Mono', monospace;
        font-size: 14px;
        padding: 20px;
        height: 100%;
        overflow-y: auto;
        border-radius: 4px;
        box-sizing: border-box;
      ">
        <div style="color: #0dbc79; margin-bottom: 15px; line-height: 1.2;">
          ╭─────────────────────────────────────────╮<br>
          │      WebVM Console (Interactive)        │<br>
          │   Type commands and press Enter         │<br>
          ╰─────────────────────────────────────────╯
        </div>
        <div id="terminal-output" style="margin-bottom: 15px; min-height: 200px; max-height: 300px; overflow-y: auto;"></div>
        <div style="display: flex; align-items: center; border-top: 1px solid #333; padding-top: 10px;">
          <span style="color: #0dbc79; margin-right: 8px;">root@webvm</span>
          <span style="color: #2472c8; margin-right: 8px;">~</span>
          <span style="margin-right: 8px;">$</span>
          <input 
            id="terminal-input" 
            type="text" 
            style="
              background: transparent; 
              border: none; 
              outline: none; 
              color: #ffffff; 
              font-family: inherit; 
              font-size: inherit;
              flex: 1;
              min-width: 0;
            " 
            placeholder="Type commands here (e.g., ps aux, ls -la)..."
            autocomplete="off"
          />
        </div>
      </div>
    `;
    
    // Wait a bit for DOM to settle
    setTimeout(() => {
      const input = terminalRef.current?.querySelector('#terminal-input') as HTMLInputElement;
      const output = terminalRef.current?.querySelector('#terminal-output') as HTMLDivElement;
      
      if (input && output) {
        addDebugLog('debug', 'Setting up terminal input handlers...');
        
        // Show welcome message
        output.innerHTML = `
          <div style="color: #0dbc79; margin: 5px 0;">
            Welcome to WebVM Console! Try these commands:<br>
            • ps aux - Show running processes<br>
            • ls -la - List files<br>
            • uname -a - System information<br>
            • free -h - Memory usage<br>
          </div>
        `;
        
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            const command = input.value.trim();
            if (command) {
              // Add command to output
              output.innerHTML += `<div style="margin: 8px 0; border-left: 3px solid #0dbc79; padding-left: 8px;"><span style="color: #0dbc79;">root@webvm</span><span style="color: #2472c8;">:~</span>$ ${command}</div>`;
              
              // Clear input immediately
              input.value = '';
              
              // Show executing indicator
              const executingDiv = document.createElement('div');
              executingDiv.style.cssText = 'margin: 5px 0; color: #888; font-style: italic;';
              executingDiv.innerHTML = '⏳ Executing...';
              output.appendChild(executingDiv);
              output.scrollTop = output.scrollHeight;
              
              try {
                addDebugLog('debug', `Executing command: ${command}`);
                
                // Execute command
                const response = await fetch('/api/debug/webvm/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command, workingDirectory: '/root' })
                });
                
                // Remove executing indicator
                executingDiv.remove();
                
                if (response.ok) {
                  const result = await response.json();
                  const commandOutput = result.output || 'Command executed successfully';
                  const exitCode = result.exitCode || 0;
                  
                  const outputDiv = document.createElement('div');
                  outputDiv.style.cssText = 'margin: 5px 0; white-space: pre-wrap; background: #2a2a2a; padding: 8px; border-radius: 4px; font-family: inherit;';
                  outputDiv.textContent = commandOutput;
                  output.appendChild(outputDiv);
                  
                  // Show exit code
                  const exitDiv = document.createElement('div');
                  exitDiv.style.cssText = `margin: 2px 0; font-size: 12px; color: ${exitCode === 0 ? '#0dbc79' : '#cd3131'};`;
                  exitDiv.textContent = `Exit code: ${exitCode}`;
                  output.appendChild(exitDiv);
                  
                  addDebugLog('info', `Command executed successfully: ${command}`, { exitCode });
                } else {
                  const errorDiv = document.createElement('div');
                  errorDiv.style.cssText = 'margin: 5px 0; color: #cd3131; background: #3a1a1a; padding: 8px; border-radius: 4px;';
                  errorDiv.textContent = `Error: Command execution failed (${response.status})`;
                  output.appendChild(errorDiv);
                  
                  addDebugLog('error', `Command failed: ${command}`, { status: response.status });
                }
              } catch (error) {
                // Remove executing indicator
                executingDiv.remove();
                
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'margin: 5px 0; color: #cd3131; background: #3a1a1a; padding: 8px; border-radius: 4px;';
                errorDiv.textContent = `Error: ${error.message}`;
                output.appendChild(errorDiv);
                
                addDebugLog('error', `Command exception: ${command}`, { error: error.message });
              }
              
              output.scrollTop = output.scrollHeight;
            }
          } else if (e.key === 'ArrowUp') {
            // TODO: Command history
            e.preventDefault();
          } else if (e.key === 'Tab') {
            // TODO: Command completion
            e.preventDefault();
          }
        });
        
        // Focus the input
        input.focus();
        
        setIsTerminalReady(true);
        addDebugLog('info', 'Fallback terminal interface created and ready');
      } else {
        addDebugLog('error', 'Failed to find terminal input/output elements');
        setIsTerminalReady(false);
      }
    }, 100);
  };

  const writePrompt = (terminal: any) => {
    terminal.write('\r\n\x1b[1;32mroot@webvm\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
  };

  const handleTerminalInput = async (terminal: any, data: string) => {
    const charCode = data.charCodeAt(0);
    
    if (charCode === 13) { // Enter key
      if (currentInput.trim()) {
        await executeTerminalCommand(terminal, currentInput.trim());
      } else {
        writePrompt(terminal);
      }
      setCurrentInput('');
      setCursorPosition(0);
    } else if (charCode === 127) { // Backspace
      if (currentInput.length > 0) {
        const newInput = currentInput.slice(0, -1);
        setCurrentInput(newInput);
        setCursorPosition(newInput.length);
        terminal.write('\b \b');
      }
    } else if (charCode >= 32) { // Printable characters
      const newInput = currentInput + data;
      setCurrentInput(newInput);
      setCursorPosition(newInput.length);
      terminal.write(data);
    } else if (charCode === 3) { // Ctrl+C
      terminal.write('^C');
      writePrompt(terminal);
      setCurrentInput('');
      setCursorPosition(0);
    } else if (charCode === 12) { // Ctrl+L
      terminal.clear();
      writePrompt(terminal);
    }
  };

  const executeTerminalCommand = async (terminal: any, command: string) => {
    try {
      addDebugLog('info', `Terminal: Executing command: ${command}`);
      
      // Execute command via WebVM API
      const response = await fetch('/api/debug/webvm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command: command,
          workingDirectory: '/root'
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Write output to terminal
        if (result.output) {
          terminal.writeln('');
          const lines = result.output.split('\n');
          lines.forEach((line: string) => {
            terminal.writeln(line);
          });
        }
        
        // Log command execution
        addDebugLog('info', `Terminal: Command completed with exit code ${result.exitCode}`);
      } else {
        terminal.writeln('');
        terminal.write('\x1b[1;31mError: Command execution failed\x1b[0m');
        addDebugLog('error', `Terminal: Command failed with status ${response.status}`);
      }
    } catch (error) {
      terminal.writeln('');
      terminal.write('\x1b[1;31mError: ' + (error as Error).message + '\x1b[0m');
      addDebugLog('error', `Terminal: Command exception: ${(error as Error).message}`);
    }
    
    writePrompt(terminal);
  };

  const clearTerminal = () => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
      writePrompt(terminalInstance.current);
    }
  };

  const runTerminalCommand = (command: string) => {
    // For fallback terminal, simulate typing the command and executing it
    const input = terminalRef.current?.querySelector('#terminal-input') as HTMLInputElement;
    if (input) {
      input.value = command;
      // Trigger the enter key event
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);
    } else if (terminalInstance.current) {
      // For real xterm terminal (if it ever works)
      setCurrentInput(command);
      terminalInstance.current.write(command);
      executeTerminalCommand(terminalInstance.current, command);
    }
  };

  useEffect(() => {
    checkWebVMSystem();
    
    // Set up periodic state checking
    const interval = setInterval(checkWebVMSystem, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize terminal when console tab is accessed
  useEffect(() => {
    const tryInitializeTerminal = async () => {
      addDebugLog('debug', 'useEffect triggered - checking for terminal initialization');
      
      if (terminalRef.current && !terminalInstance.current && !isTerminalReady) {
        addDebugLog('debug', 'Terminal ref available, starting initialization...');
        await initializeTerminal();
      } else {
        addDebugLog('debug', 'Terminal initialization skipped', {
          hasTerminalRef: !!terminalRef.current,
          hasTerminalInstance: !!terminalInstance.current,
          isTerminalReady
        });
      }
    };

    // Try immediately
    tryInitializeTerminal();

    // Also try after a short delay in case the ref isn't ready
    const timer1 = setTimeout(tryInitializeTerminal, 100);
    const timer2 = setTimeout(tryInitializeTerminal, 500);
    const timer3 = setTimeout(tryInitializeTerminal, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
        setIsTerminalReady(false);
      }
    };
  }, []);

  // Also trigger when isTerminalReady changes
  useEffect(() => {
    if (!isTerminalReady && terminalRef.current && !terminalInstance.current) {
      addDebugLog('debug', 'Terminal not ready, attempting re-initialization');
      const timer = setTimeout(async () => {
        await initializeTerminal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTerminalReady]);

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="state">System State</TabsTrigger>
              <TabsTrigger value="runtimes">Active Runtimes</TabsTrigger>
              <TabsTrigger value="console">Console</TabsTrigger>
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
            
            <TabsContent value="console" className="space-y-4">
              <div className="space-y-4">
                {/* Quick Commands */}
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => runTerminalCommand('ps aux')}
                    disabled={!isTerminalReady}
                  >
                    ps aux
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => runTerminalCommand('ls -la')}
                    disabled={!isTerminalReady}
                  >
                    ls -la
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => runTerminalCommand('uname -a')}
                    disabled={!isTerminalReady}
                  >
                    uname -a
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => runTerminalCommand('free -h')}
                    disabled={!isTerminalReady}
                  >
                    free -h
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => runTerminalCommand('df -h')}
                    disabled={!isTerminalReady}
                  >
                    df -h
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearTerminal}
                    disabled={!isTerminalReady}
                  >
                    Clear
                  </Button>
                </div>

                {/* Interactive Terminal */}
                <div className="border rounded-lg overflow-hidden bg-[#1e1e1e]">
                  <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm text-gray-300 font-mono">WebVM Terminal</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {webvmState.initialized ? (
                        <span className="text-green-400">● Connected ({webvmState.providerType})</span>
                      ) : (
                        <span className="text-orange-400">● Simulation Mode</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Terminal Container */}
                  <div className="relative">
                    <div 
                      ref={(el) => {
                        terminalRef.current = el;
                        // Trigger terminal initialization when ref becomes available
                        // Use a flag to prevent multiple initializations
                        if (el && !terminalInstance.current && !isTerminalReady && !el.dataset.initializing) {
                          el.dataset.initializing = 'true';
                          setTimeout(async () => {
                            await initializeTerminal();
                          }, 100);
                        }
                      }} 
                      className="h-96 w-full"
                      style={{ 
                        minHeight: '400px',
                        background: '#1e1e1e'
                      }}
                    />
                    
                    {!isTerminalReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] bg-opacity-90">
                        <div className="flex items-center gap-2 text-white">
                          <div className="animate-spin h-4 w-4 border border-white border-t-transparent rounded-full"></div>
                          <span>Initializing terminal...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Terminal Info */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Type commands and press Enter to execute</p>
                  <p>• Use Ctrl+C to interrupt, Ctrl+L to clear screen</p>
                  <p>• Click quick command buttons above for common operations</p>
                  {!webvmState.initialized && (
                    <p className="text-orange-600">• WebVM not fully initialized - showing simulated responses</p>
                  )}
                </div>
              </div>
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