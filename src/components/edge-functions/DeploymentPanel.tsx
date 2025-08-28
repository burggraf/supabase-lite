import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Rocket,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Settings,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EdgeFunction {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  isDeployed: boolean;
}

interface Deployment {
  id: string;
  functionName: string;
  version: number;
  status: 'building' | 'deployed' | 'failed';
  url?: string;
  deployedAt: Date;
  buildLog?: string[];
  environmentVars?: Record<string, string>;
}

interface DeploymentPanelProps {
  functions: EdgeFunction[];
  onRefresh?: () => void;
}

export function DeploymentPanel({ functions, onRefresh }: DeploymentPanelProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [environmentVars, setEnvironmentVars] = useState<Array<{key: string, value: string}>>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [showDeploymentDetails, setShowDeploymentDetails] = useState<Deployment | null>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  
  // Test function state
  const [selectedTestFunction, setSelectedTestFunction] = useState<string>('');
  const [testRequestMethod, setTestRequestMethod] = useState<'GET' | 'POST'>('POST');
  const [testRequestBody, setTestRequestBody] = useState('{\n  "name": "Developer"\n}');
  const [testRequestHeaders, setTestRequestHeaders] = useState<Array<{key: string, value: string}>>([
    { key: 'Content-Type', value: 'application/json' }
  ]);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [isTestingFunction, setIsTestingFunction] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);

  useEffect(() => {
    loadDeployments();
  }, []);

  const loadDeployments = async () => {
    // TODO: Load deployments from VFS or storage
    // For now, create mock deployments
    const mockDeployments: Deployment[] = functions
      .filter(f => f.isDeployed)
      .map((func, index) => ({
        id: `deployment-${index}`,
        functionName: func.name.replace('.ts', ''),
        version: 1,
        status: 'deployed' as const,
        url: `/functions/${func.name.replace('.ts', '')}`,
        deployedAt: func.lastModified,
        environmentVars: {}
      }));
    
    setDeployments(mockDeployments);
  };

  const handleDeploy = async () => {
    if (!selectedFunction) {
      toast.error('Please select a function to deploy');
      return;
    }

    try {
      setIsDeploying(true);
      setBuildLogs(['Starting deployment...']);
      
      // Simulate deployment process
      await simulateDeployment();
      
      const newDeployment: Deployment = {
        id: `deployment-${Date.now()}`,
        functionName: selectedFunction.replace('.ts', ''),
        version: deployments.filter(d => d.functionName === selectedFunction.replace('.ts', '')).length + 1,
        status: 'deployed',
        url: `/functions/${selectedFunction.replace('.ts', '')}`,
        deployedAt: new Date(),
        buildLog: buildLogs,
        environmentVars: environmentVars.reduce((acc, {key, value}) => {
          if (key.trim() && value.trim()) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, string>)
      };

      setDeployments(prev => [newDeployment, ...prev]);
      setShowDeployDialog(false);
      toast.success(`${selectedFunction.replace('.ts', '')} deployed successfully!`);
      onRefresh?.();
    } catch (error) {
      console.error('Deployment failed:', error);
      toast.error('Deployment failed: ' + (error as Error).message);
      
      const failedDeployment: Deployment = {
        id: `deployment-${Date.now()}`,
        functionName: selectedFunction.replace('.ts', ''),
        version: deployments.filter(d => d.functionName === selectedFunction.replace('.ts', '')).length + 1,
        status: 'failed',
        deployedAt: new Date(),
        buildLog: [...buildLogs, 'ERROR: Deployment failed'],
        environmentVars: {}
      };
      
      setDeployments(prev => [failedDeployment, ...prev]);
    } finally {
      setIsDeploying(false);
    }
  };

  const simulateDeployment = async () => {
    const steps = [
      'Validating function code...',
      'Installing dependencies...',
      'Building function bundle...',
      'Optimizing for Deno runtime...',
      'Deploying to edge locations...',
      'Updating routing configuration...',
      'Deployment completed!'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setBuildLogs(prev => [...prev, steps[i]]);
    }
  };

  const handleRollback = async (deployment: Deployment) => {
    try {
      // TODO: Implement rollback functionality
      toast.success(`Rolled back to version ${deployment.version}`);
      loadDeployments();
    } catch (error) {
      console.error('Rollback failed:', error);
      toast.error('Rollback failed: ' + (error as Error).message);
    }
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment?')) {
      return;
    }

    try {
      setDeployments(prev => prev.filter(d => d.id !== deploymentId));
      toast.success('Deployment deleted');
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      toast.error('Failed to delete deployment');
    }
  };

  const copyFunctionUrl = (deployment: Deployment) => {
    if (deployment.url) {
      const fullUrl = `${window.location.origin}${deployment.url}`;
      navigator.clipboard.writeText(fullUrl);
      toast.success('Function URL copied to clipboard');
    }
  };

  const handleTestFunction = async () => {
    if (!selectedTestFunction) {
      toast.error('Please select a function to test');
      return;
    }

    try {
      setIsTestingFunction(true);
      setTestResponse(null);

      const functionName = selectedTestFunction.replace('.ts', '');
      const functionUrl = `${window.location.origin}/functions/${functionName}`;

      // Prepare headers
      const headers: Record<string, string> = {};
      testRequestHeaders.forEach(({key, value}) => {
        if (key.trim() && value.trim()) {
          headers[key] = value;
        }
      });

      // Prepare request options
      const requestOptions: RequestInit = {
        method: testRequestMethod,
        headers
      };

      // Add body for POST requests
      if (testRequestMethod === 'POST' && testRequestBody.trim()) {
        try {
          JSON.parse(testRequestBody); // Validate JSON
          requestOptions.body = testRequestBody;
        } catch (error) {
          toast.error('Invalid JSON in request body');
          return;
        }
      }

      const startTime = Date.now();
      const response = await fetch(functionUrl, requestOptions);
      const endTime = Date.now();
      
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      setTestResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        duration: endTime - startTime
      });

      if (response.ok) {
        toast.success(`Function executed successfully (${endTime - startTime}ms)`);
      } else {
        toast.error(`Function returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Function test failed:', error);
      toast.error('Function test failed: ' + (error as Error).message);
      setTestResponse({
        error: true,
        message: (error as Error).message
      });
    } finally {
      setIsTestingFunction(false);
    }
  };

  const addTestHeader = () => {
    setTestRequestHeaders(prev => [...prev, { key: '', value: '' }]);
  };

  const updateTestHeader = (index: number, field: 'key' | 'value', value: string) => {
    setTestRequestHeaders(prev => prev.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    ));
  };

  const removeTestHeader = (index: number) => {
    setTestRequestHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const addEnvironmentVar = () => {
    setEnvironmentVars(prev => [...prev, { key: '', value: '' }]);
  };

  const updateEnvironmentVar = (index: number, field: 'key' | 'value', value: string) => {
    setEnvironmentVars(prev => prev.map((env, i) => 
      i === index ? { ...env, [field]: value } : env
    ));
  };

  const removeEnvironmentVar = (index: number) => {
    setEnvironmentVars(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'building': return <Clock className="h-4 w-4 animate-spin" />;
      case 'deployed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'building': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'deployed': return 'bg-green-50 text-green-700 border-green-200';
      case 'failed': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Deployments</h3>
          <p className="text-sm text-muted-foreground">
            Deploy and manage your Edge Functions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowTestDialog(true)} 
            className="gap-2"
            disabled={deployments.filter(d => d.status === 'deployed').length === 0}
          >
            <Play className="h-4 w-4" />
            Test Function
          </Button>
          <Button onClick={() => setShowDeployDialog(true)} className="gap-2">
            <Rocket className="h-4 w-4" />
            Deploy Function
          </Button>
        </div>
      </div>

      {/* Deployment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Deployments</p>
                <p className="text-2xl font-bold">{deployments.length}</p>
              </div>
              <Archive className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {deployments.filter(d => d.status === 'deployed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Building</p>
                <p className="text-2xl font-bold text-blue-600">
                  {deployments.filter(d => d.status === 'building').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {deployments.filter(d => d.status === 'failed').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>
            View and manage your Edge Function deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-8">
              <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium mb-2">No deployments yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Deploy your first Edge Function to get started
              </p>
              <Button onClick={() => setShowDeployDialog(true)}>
                <Rocket className="h-4 w-4 mr-2" />
                Deploy Function
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deployment.status)}
                      <Badge className={cn("gap-1", getStatusColor(deployment.status))}>
                        {deployment.status}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium">{deployment.functionName}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>v{deployment.version}</span>
                        <span>Deployed {formatDate(deployment.deployedAt)}</span>
                        {deployment.url && (
                          <button
                            onClick={() => copyFunctionUrl(deployment)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                            {deployment.url}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deployment.status === 'deployed' && deployment.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(deployment.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeploymentDetails(deployment)}
                    >
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(deployment)}
                      disabled={deployment.status !== 'deployed'}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDeployment(deployment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deploy Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deploy Edge Function</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="function" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="function">Function</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="function" className="space-y-4">
              <div className="space-y-2">
                <Label>Select Function</Label>
                <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a function to deploy" />
                  </SelectTrigger>
                  <SelectContent>
                    {functions.map((func) => (
                      <SelectItem key={func.path} value={func.name}>
                        {func.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedFunction && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <p><strong>Function:</strong> {selectedFunction}</p>
                    <p><strong>URL:</strong> /functions/{selectedFunction.replace('.ts', '')}</p>
                    <p><strong>Runtime:</strong> Deno</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="environment" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Environment Variables</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEnvironmentVar}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Variable
                  </Button>
                </div>
                
                {environmentVars.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No environment variables configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {environmentVars.map((env, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Key"
                          value={env.key}
                          onChange={(e) => updateEnvironmentVar(index, 'key', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Value"
                          type="password"
                          value={env.value}
                          onChange={(e) => updateEnvironmentVar(index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEnvironmentVar(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Deployment Configuration</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Functions are deployed to Deno runtime</p>
                    <p>• TypeScript files are automatically compiled</p>
                    <p>• Dependencies from jsr: and npm: are bundled</p>
                    <p>• Functions are available at /functions/[function-name]</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {isDeploying && (
            <div className="space-y-2">
              <Label>Build Log</Label>
              <div className="max-h-32 overflow-y-auto bg-muted p-3 rounded font-mono text-sm">
                {buildLogs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeployDialog(false)}
              disabled={isDeploying}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeploy}
              disabled={!selectedFunction || isDeploying}
              className="gap-2"
            >
              {isDeploying ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Function Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Edge Function</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Request */}
            <div className="space-y-4">
              <h3 className="font-medium">Request</h3>
              
              {/* Function Selection */}
              <div className="space-y-2">
                <Label>Select Function</Label>
                <Select value={selectedTestFunction} onValueChange={setSelectedTestFunction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a function to test" />
                  </SelectTrigger>
                  <SelectContent>
                    {deployments
                      .filter(d => d.status === 'deployed')
                      .map((deployment) => (
                        <SelectItem key={deployment.id} value={deployment.functionName + '.ts'}>
                          {deployment.functionName} (v{deployment.version})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedTestFunction && (
                  <div className="text-xs text-muted-foreground">
                    URL: /functions/{selectedTestFunction.replace('.ts', '')}
                  </div>
                )}
              </div>

              {/* HTTP Method */}
              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select value={testRequestMethod} onValueChange={(value: 'GET' | 'POST') => setTestRequestMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Headers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Headers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTestHeader}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Header
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {testRequestHeaders.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Header name"
                        value={header.key}
                        onChange={(e) => updateTestHeader(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Header value"
                        value={header.value}
                        onChange={(e) => updateTestHeader(index, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTestHeader(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Body (for POST) */}
              {testRequestMethod === 'POST' && (
                <div className="space-y-2">
                  <Label>Request Body (JSON)</Label>
                  <Textarea
                    placeholder='{\n  "name": "Developer"\n}'
                    value={testRequestBody}
                    onChange={(e) => setTestRequestBody(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="text-xs text-muted-foreground">
                    Enter valid JSON data to send to your function
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Response */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Response</h3>
                <Button
                  onClick={handleTestFunction}
                  disabled={!selectedTestFunction || isTestingFunction}
                  className="gap-2"
                >
                  {isTestingFunction ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>

              {testResponse ? (
                <div className="space-y-3">
                  {testResponse.error ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-sm font-medium text-red-800">Error</div>
                      <div className="text-sm text-red-600 mt-1">{testResponse.message}</div>
                    </div>
                  ) : (
                    <>
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <Badge className={testResponse.status < 400 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                          {testResponse.status} {testResponse.statusText}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {testResponse.duration}ms
                        </span>
                      </div>

                      {/* Response Headers */}
                      <div>
                        <Label className="text-xs">Response Headers</Label>
                        <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-24 overflow-y-auto">
                          {Object.entries(testResponse.headers).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-blue-600">{key}:</span> {value as string}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Response Body */}
                      <div>
                        <Label className="text-xs">Response Body</Label>
                        <div className="mt-1 p-3 bg-muted rounded text-sm font-mono max-h-64 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">
                            {typeof testResponse.data === 'object' 
                              ? JSON.stringify(testResponse.data, null, 2)
                              : testResponse.data
                            }
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a function and click "Send Request" to test it</p>
                  <p className="text-xs mt-1">Response will appear here in real-time</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTestDialog(false);
                setTestResponse(null);
              }}
              disabled={isTestingFunction}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deployment Details Dialog */}
      <Dialog open={!!showDeploymentDetails} onOpenChange={() => setShowDeploymentDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Deployment Details: {showDeploymentDetails?.functionName}
            </DialogTitle>
          </DialogHeader>
          
          {showDeploymentDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(showDeploymentDetails.status)}
                    <Badge className={getStatusColor(showDeploymentDetails.status)}>
                      {showDeploymentDetails.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <p className="mt-1">v{showDeploymentDetails.version}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Deployed At</Label>
                  <p className="mt-1">{formatDate(showDeploymentDetails.deployedAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Function URL</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {showDeploymentDetails.url}
                    </code>
                    {showDeploymentDetails.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyFunctionUrl(showDeploymentDetails)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {showDeploymentDetails.environmentVars && Object.keys(showDeploymentDetails.environmentVars).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Environment Variables</Label>
                  <div className="mt-2 space-y-1">
                    {Object.entries(showDeploymentDetails.environmentVars).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <code className="bg-muted px-2 py-1 rounded">{key}</code>
                        <span>=</span>
                        <code className="bg-muted px-2 py-1 rounded">{"*".repeat(8)}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showDeploymentDetails.buildLog && (
                <div>
                  <Label className="text-sm font-medium">Build Log</Label>
                  <div className="mt-2 max-h-48 overflow-y-auto bg-muted p-3 rounded font-mono text-sm">
                    {showDeploymentDetails.buildLog.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeploymentDetails(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}