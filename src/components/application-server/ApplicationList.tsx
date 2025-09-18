/**
 * ApplicationList Component - Display and manage applications
 * 
 * Shows a list of applications with their status, runtime, and management actions.
 * Integrates with the Application Server API for real-time data.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Play, 
  Square, 
  Trash2, 
  Edit, 
  ExternalLink,
  Clock,
  Server,
  Eye
} from 'lucide-react';
import { Application, ApplicationStatus, ApplicationServerError } from '@/types/application-server';

interface ApplicationListProps {
  applications: Application[];
  loading: boolean;
  error: ApplicationServerError | null;
  onCreateApplication?: () => void;
  onEditApplication?: (application: Application) => void;
  onViewApplication?: (application: Application) => void;
  onStartApplication?: (id: string) => Promise<Application>;
  onStopApplication?: (id: string) => Promise<Application>;
  onDeleteApplication?: (id: string) => Promise<void>;
}

export function ApplicationList({ 
  applications,
  loading,
  error,
  onCreateApplication, 
  onEditApplication,
  onViewApplication,
  onStartApplication,
  onStopApplication,
  onDeleteApplication
}: ApplicationListProps) {

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleStart = async (id: string) => {
    if (!onStartApplication) return;
    setActionLoading(id);
    try {
      await onStartApplication(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    if (!onStopApplication) return;
    setActionLoading(id);
    try {
      await onStopApplication(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteApplication) return;
    if (!confirm('Are you sure you want to delete this application?')) {
      return;
    }
    
    setActionLoading(id);
    try {
      await onDeleteApplication(id);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Loading applications...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            No applications found. Create your first application to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <Server className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No applications</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first WebVM application
              </p>
              {onCreateApplication && (
                <Button onClick={onCreateApplication}>
                  Create Application
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Applications ({applications.length})</CardTitle>
            <CardDescription>
              Manage your deployed applications and their runtime status
            </CardDescription>
          </div>
          {onCreateApplication && (
            <Button onClick={onCreateApplication}>
              Create Application
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Runtime</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{app.name}</div>
                    {app.description && (
                      <div className="text-sm text-muted-foreground">
                        {app.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{app.runtimeId}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {app.status === ApplicationStatus.RUNNING ? (
                    <div className="flex items-center space-x-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        /app/{app.id}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/app/${app.id}`)}
                        className="h-6 w-6 p-0"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(app.createdAt)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {app.status === ApplicationStatus.RUNNING ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStop(app.id)}
                        disabled={actionLoading === app.id}
                      >
                        <Square className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStart(app.id)}
                        disabled={actionLoading === app.id}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {app.status === ApplicationStatus.RUNNING && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`/app/${app.id}`, '_blank')}
                        title="Open app in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {onViewApplication && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (app.status === ApplicationStatus.RUNNING) {
                            window.open(`/app/${app.id}`, '_blank');
                          } else {
                            onViewApplication(app);
                          }
                        }}
                        title={app.status === ApplicationStatus.RUNNING ? "Open app in new tab" : "View app details"}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    
                    {onEditApplication && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onEditApplication(app)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(app.id)}
                      disabled={actionLoading === app.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}