/**
 * RuntimeManager Component - Manage runtime environments
 * 
 * Allows users to view available runtimes, install new ones,
 * and manage runtime configurations.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  Package, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  HardDrive,
  Cpu,
  Info
} from 'lucide-react';
import { RuntimeEnvironment, RuntimeStatus } from '@/types/application-server';
import { useApplicationServer } from '@/hooks/useApplicationServer';

interface RuntimeManagerProps {
  onSelectRuntime?: (runtime: RuntimeEnvironment) => void;
}

export function RuntimeManager({ onSelectRuntime }: RuntimeManagerProps) {
  const {
    runtimes,
    loading,
    error,
    installRuntime,
    refreshData
  } = useApplicationServer();
  
  const [installingRuntime, setInstallingRuntime] = useState<string | null>(null);

  const handleInstallRuntime = async (runtimeId: string) => {
    setInstallingRuntime(runtimeId);
    try {
      await installRuntime(runtimeId);
      await refreshData(); // Refresh to get updated status
    } finally {
      setInstallingRuntime(null);
    }
  };

  const getStatusColor = (status: RuntimeStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'installing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unavailable':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: RuntimeStatus) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4" />;
      case 'installing':
        return <Clock className="h-4 w-4" />;
      case 'unavailable':
        return <Download className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Runtime Environments</CardTitle>
            <CardDescription>Loading runtime environments...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <Skeleton className="h-8 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error.message}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2" 
            onClick={refreshData}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const availableRuntimes = runtimes.filter(r => r.status === 'available').length;
  const totalRuntimes = runtimes.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Runtime Environments</h2>
          <p className="text-muted-foreground">
            Manage runtime environments for your applications ({availableRuntimes}/{totalRuntimes} available)
          </p>
        </div>
        <Button onClick={refreshData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Runtime Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {runtimes.map((runtime) => (
          <Card 
            key={runtime.id} 
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              onSelectRuntime ? 'hover:border-primary' : ''
            }`}
            onClick={() => onSelectRuntime?.(runtime)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{runtime.name}</CardTitle>
                </div>
                <Badge className={getStatusColor(runtime.status)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(runtime.status)}
                    <span>{runtime.status}</span>
                  </div>
                </Badge>
              </div>
              <CardDescription>
                Version {runtime.version}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {runtime.description}
              </p>
              
              {/* Runtime Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1">
                    <HardDrive className="h-3 w-3" />
                    <span>Size</span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatFileSize(runtime.config?.imageSize || 0)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-1">
                    <Cpu className="h-3 w-3" />
                    <span>Memory</span>
                  </span>
                  <span className="text-muted-foreground">
                    {runtime.config?.defaultMemoryLimit || 512} MB
                  </span>
                </div>
              </div>

              {/* Tags */}
              {runtime.config?.tags && runtime.config.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {runtime.config.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="space-y-2">
                {runtime.status === 'unavailable' && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstallRuntime(runtime.id);
                    }}
                    disabled={installingRuntime === runtime.id}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {installingRuntime === runtime.id ? 'Installing...' : 'Install'}
                  </Button>
                )}
                
                {runtime.status === 'available' && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Open runtime configuration
                        console.log('Configure runtime:', runtime.id);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Show runtime details
                        console.log('Runtime details:', runtime.id);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {runtime.status === 'installing' && (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    <Clock className="h-4 w-4 mr-2" />
                    Installing...
                  </Button>
                )}
                
                {runtime.status === 'error' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstallRuntime(runtime.id);
                    }}
                    disabled={installingRuntime === runtime.id}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Retry Install
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {runtimes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Runtime Environments</h3>
            <p className="text-muted-foreground text-center mb-4">
              No runtime environments are available. This might indicate a configuration issue.
            </p>
            <Button onClick={refreshData}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Runtime Statistics */}
      {runtimes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Runtime Statistics</CardTitle>
            <CardDescription>
              Overview of runtime environment availability and usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{availableRuntimes}</div>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {runtimes.filter(r => r.status === 'installing').length}
                </div>
                <p className="text-sm text-muted-foreground">Installing</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {runtimes.filter(r => r.status === 'unavailable').length}
                </div>
                <p className="text-sm text-muted-foreground">Not Installed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {runtimes.filter(r => r.status === 'error').length}
                </div>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}