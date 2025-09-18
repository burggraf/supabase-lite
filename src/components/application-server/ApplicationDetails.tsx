/**
 * ApplicationDetails Component - Detailed view of an application
 * 
 * Shows comprehensive application information including configuration,
 * logs, metrics, and management actions.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Activity, 
  FileText, 
  ExternalLink,
  AlertCircle,
  Clock,
  MemoryStick,
  Cpu,
  HardDrive
} from 'lucide-react';
import { Application, ApplicationStatus } from '@/types/application-server';
import { useApplicationServer } from '@/hooks/useApplicationServer';

interface ApplicationDetailsProps {
  application: Application;
  onClose?: () => void;
  onEdit?: (application: Application) => void;
}

export function ApplicationDetails({ 
  application, 
  onClose, 
  onEdit 
}: ApplicationDetailsProps) {
  const {
    startApplication,
    stopApplication,
    deleteApplication,
    loading,
    error
  } = useApplicationServer();
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [logs, setLogs] = useState<string[]>([
    '[2024-01-15 10:30:15] Application started successfully',
    '[2024-01-15 10:30:16] Runtime initialized: nodejs-18',
    '[2024-01-15 10:30:17] Server listening on port 3000',
    '[2024-01-15 10:30:18] Health check passed'
  ]);

  const handleStart = async () => {
    setActionLoading('start');
    try {
      await startApplication(application.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      await stopApplication(application.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    try {
      await stopApplication(application.id);
      // Small delay for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      await startApplication(application.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${application.name}"? This action cannot be undone.`)) {
      return;
    }
    
    setActionLoading('delete');
    try {
      await deleteApplication(application.id);
      onClose?.();
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.RUNNING:
        return 'bg-green-100 text-green-800 border-green-200';
      case ApplicationStatus.STARTING:
      case ApplicationStatus.DEPLOYING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case ApplicationStatus.STOPPED:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case ApplicationStatus.ERROR:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  // Mock metrics data - in real implementation, this would come from the API
  const metrics = {
    memoryUsage: 124,
    memoryLimit: 512,
    cpuUsage: 15.6,
    requests: 1234,
    responseTime: 89,
    uptime: '2h 34m'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-bold">{application.name}</h1>
            {application.description && (
              <p className="text-muted-foreground">{application.description}</p>
            )}
          </div>
          <Badge className={getStatusColor(application.status)}>
            {application.status}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          {application.status === ApplicationStatus.RUNNING && (
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View App
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(application)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Back
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Application Control</CardTitle>
          <CardDescription>
            Start, stop, or restart your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {application.status === ApplicationStatus.RUNNING ? (
              <Button
                onClick={handleStop}
                disabled={actionLoading === 'stop'}
                variant="outline"
              >
                <Square className="h-4 w-4 mr-2" />
                {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={actionLoading === 'start'}
              >
                <Play className="h-4 w-4 mr-2" />
                {actionLoading === 'start' ? 'Starting...' : 'Start'}
              </Button>
            )}
            
            <Button
              onClick={handleRestart}
              disabled={actionLoading === 'restart'}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </Button>
            
            <Button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              variant="destructive"
            >
              {actionLoading === 'delete' ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.memoryUsage} MB</div>
                <p className="text-xs text-muted-foreground">
                  of {metrics.memoryLimit} MB ({Math.round((metrics.memoryUsage / metrics.memoryLimit) * 100)}%)
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.cpuUsage}%</div>
                <p className="text-xs text-muted-foreground">Current usage</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.requests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total served</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.uptime}</div>
                <p className="text-xs text-muted-foreground">Current session</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">Runtime</h4>
                  <Badge variant="outline">{application.runtimeId}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Created</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(application.createdAt)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Last Updated</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(application.updatedAt)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Application ID</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {application.id}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Real-time application performance and resource usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Average Response Time</span>
                  <span className="text-sm text-muted-foreground">{metrics.responseTime}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics.memoryUsage}MB / {metrics.memoryLimit}MB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm text-muted-foreground">{metrics.cpuUsage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Requests</span>
                  <span className="text-sm text-muted-foreground">{metrics.requests.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Logs</CardTitle>
              <CardDescription>
                Real-time logs from your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-64 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Application settings and environment variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Environment Variables</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">NODE_ENV</span>
                      <span className="text-sm text-muted-foreground">production</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono text-sm">PORT</span>
                      <span className="text-sm text-muted-foreground">3000</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Resource Limits</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Memory Limit</span>
                      <span className="text-sm text-muted-foreground">{metrics.memoryLimit} MB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">CPU Limit</span>
                      <span className="text-sm text-muted-foreground">1 vCPU</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}