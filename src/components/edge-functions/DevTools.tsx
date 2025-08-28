import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Terminal, 
  Network, 
  Bug, 
  Activity, 
  Filter,
  X,
  Download,
  Play,
  Square,
  Clock,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EdgeFunction {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  isDeployed: boolean;
}

interface DevToolsProps {
  functions: EdgeFunction[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'function' | 'runtime' | 'system';
  functionName?: string;
  message: string;
  details?: any;
}

interface NetworkRequest {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status: number;
  duration: number;
  functionName?: string;
  headers: Record<string, string>;
  body?: any;
  response?: any;
}

interface PerformanceMetric {
  functionName: string;
  avgDuration: number;
  requestCount: number;
  errorRate: number;
  lastRequest: Date;
}

export function DevTools({ functions }: DevToolsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<string>('all');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const networkEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      networkEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, networkRequests, autoScroll]);

  useEffect(() => {
    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [isMonitoring]);

  const startMonitoring = () => {
    // Simulate real-time logs
    const logInterval = setInterval(() => {
      if (functions.length > 0) {
        const randomFunction = functions[Math.floor(Math.random() * functions.length)];
        generateMockLog(randomFunction.name);
      }
    }, 2000);

    // Simulate network requests
    const networkInterval = setInterval(() => {
      if (functions.length > 0) {
        const randomFunction = functions[Math.floor(Math.random() * functions.length)];
        generateMockNetworkRequest(randomFunction.name);
      }
    }, 3000);

    // Update performance metrics
    const metricsInterval = setInterval(() => {
      updatePerformanceMetrics();
    }, 5000);

    return () => {
      clearInterval(logInterval);
      clearInterval(networkInterval);
      clearInterval(metricsInterval);
    };
  };

  const stopMonitoring = () => {
    // Intervals are cleared in the effect cleanup
  };

  const generateMockLog = (functionName: string) => {
    const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
    const messages = [
      'Function execution started',
      'Database connection established',
      'API request processed successfully',
      'Warning: High memory usage detected',
      'Error: Failed to parse request body',
      'Debug: Processing request headers',
      'Function execution completed',
      'Cache hit for request',
      'Rate limit check passed'
    ];

    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];

    const logEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      source: 'function',
      functionName: functionName.replace('.ts', ''),
      message,
      details: level === 'error' ? { stack: 'Error stack trace would appear here...' } : undefined
    };

    setLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
  };

  const generateMockNetworkRequest = (functionName: string) => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const paths = ['/api/users', '/api/products', '/api/orders', '/api/auth'];
    const statuses = [200, 201, 400, 404, 500];

    const method = methods[Math.floor(Math.random() * methods.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const networkRequest: NetworkRequest = {
      id: `req-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      method,
      url: `/functions/${functionName.replace('.ts', '')}${path}`,
      status,
      duration: Math.floor(Math.random() * 1000) + 10,
      functionName: functionName.replace('.ts', ''),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EdgeFunction/1.0'
      },
      body: method === 'POST' ? { data: 'example' } : undefined,
      response: status < 400 ? { success: true } : { error: 'Request failed' }
    };

    setNetworkRequests(prev => [...prev.slice(-49), networkRequest]); // Keep last 50 requests
  };

  const updatePerformanceMetrics = () => {
    const metrics: PerformanceMetric[] = functions.map(func => {
      const functionName = func.name.replace('.ts', '');
      const functionRequests = networkRequests.filter(req => req.functionName === functionName);
      
      return {
        functionName,
        avgDuration: functionRequests.length > 0 
          ? Math.round(functionRequests.reduce((sum, req) => sum + req.duration, 0) / functionRequests.length)
          : 0,
        requestCount: functionRequests.length,
        errorRate: functionRequests.length > 0 
          ? Math.round((functionRequests.filter(req => req.status >= 400).length / functionRequests.length) * 100)
          : 0,
        lastRequest: functionRequests.length > 0 
          ? new Date(Math.max(...functionRequests.map(req => req.timestamp.getTime())))
          : new Date()
      };
    });

    setPerformanceMetrics(metrics);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const clearNetworkRequests = () => {
    setNetworkRequests([]);
  };

  const downloadLogs = () => {
    const logsText = logs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} ${log.functionName || 'system'}: ${log.message}`
    ).join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edge-functions-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return <Info className="h-3 w-3" />;
      case 'warn': return <AlertTriangle className="h-3 w-3" />;
      case 'error': return <AlertCircle className="h-3 w-3" />;
      case 'debug': return <Bug className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-blue-600';
      case 'warn': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'debug': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  const filteredLogs = logs.filter(log => {
    if (selectedFunction !== 'all' && log.functionName !== selectedFunction) return false;
    if (logLevel !== 'all' && log.level !== logLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredRequests = networkRequests.filter(req => {
    if (selectedFunction !== 'all' && req.functionName !== selectedFunction) return false;
    if (searchQuery && !req.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Developer Tools</h3>
          <p className="text-sm text-muted-foreground">
            Monitor logs, network requests, and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isMonitoring ? "default" : "outline"}
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
            className="gap-2"
          >
            {isMonitoring ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4">
        <Badge variant={isMonitoring ? "default" : "secondary"} className="gap-2">
          <Activity className={cn("h-3 w-3", isMonitoring && "animate-pulse")} />
          {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {logs.length} log entries • {networkRequests.length} network requests
        </span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {functions.map((func) => (
                    <SelectItem key={func.name} value={func.name.replace('.ts', '')}>
                      {func.name.replace('.ts', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Input
              placeholder="Search logs and requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                className={cn(autoScroll && "bg-accent")}
              >
                Auto-scroll
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="logs" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logs" className="gap-2">
              <Terminal className="h-4 w-4" />
              Console Logs
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-2">
              <Network className="h-4 w-4" />
              Network
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="logs" className="h-full m-0">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Console Logs</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearLogs}
                      disabled={logs.length === 0}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <div className="h-full overflow-y-auto font-mono text-sm">
                    {filteredLogs.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No logs to display</p>
                          <p className="text-sm mt-1">
                            {!isMonitoring ? 'Start monitoring to see logs' : 'Waiting for log entries...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {filteredLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 px-4 py-2 hover:bg-muted/50 border-b border-muted/30"
                          >
                            <div className="flex items-center gap-2 flex-shrink-0 w-20">
                              <div className={cn("flex items-center gap-1", getLogColor(log.level))}>
                                {getLogIcon(log.level)}
                                <span className="text-xs font-medium uppercase">
                                  {log.level}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-muted-foreground text-xs w-20">
                              {formatTimestamp(log.timestamp)}
                            </div>
                            <div className="flex-shrink-0 text-muted-foreground text-xs w-24">
                              {log.functionName || 'system'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="break-words">{log.message}</div>
                              {log.details && (
                                <div className="mt-1 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                  {JSON.stringify(log.details, null, 2)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network" className="h-full m-0">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Network Requests</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearNetworkRequests}
                      disabled={networkRequests.length === 0}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <div className="h-full overflow-y-auto">
                    {filteredRequests.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No network requests to display</p>
                          <p className="text-sm mt-1">
                            {!isMonitoring ? 'Start monitoring to see requests' : 'Waiting for network activity...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {filteredRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 border-b border-muted/30 text-sm"
                          >
                            <div className="flex-shrink-0 text-muted-foreground w-16 text-xs">
                              {formatTimestamp(request.timestamp)}
                            </div>
                            <div className="flex-shrink-0 font-mono font-medium w-16">
                              {request.method}
                            </div>
                            <div className={cn("flex-shrink-0 font-mono w-12 text-center", getStatusColor(request.status))}>
                              {request.status}
                            </div>
                            <div className="flex-shrink-0 text-muted-foreground w-16 text-right">
                              {request.duration}ms
                            </div>
                            <div className="flex-1 min-w-0 font-mono">
                              <div className="truncate">{request.url}</div>
                            </div>
                            <div className="flex-shrink-0 text-muted-foreground text-xs w-24 text-center">
                              {request.functionName}
                            </div>
                          </div>
                        ))}
                        <div ref={networkEndRef} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="h-full m-0">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Performance Metrics</CardTitle>
                  <CardDescription>
                    Function performance statistics and health metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {performanceMetrics.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No performance data available</p>
                        <p className="text-sm mt-1">
                          Deploy and test your functions to see metrics
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {performanceMetrics.map((metric) => (
                        <div
                          key={metric.functionName}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{metric.functionName}</h4>
                            <Badge variant={metric.errorRate > 10 ? "destructive" : "secondary"}>
                              {metric.errorRate}% error rate
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Avg Duration</div>
                              <div className="font-mono font-medium">
                                {metric.avgDuration}ms
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Requests</div>
                              <div className="font-mono font-medium">
                                {metric.requestCount}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Last Request</div>
                              <div className="font-mono font-medium text-xs">
                                {formatTimestamp(metric.lastRequest)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}