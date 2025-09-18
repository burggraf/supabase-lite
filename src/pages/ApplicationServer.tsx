/**
 * Application Server Page - Main interface for WebVM-based application hosting
 * 
 * Provides a comprehensive dashboard for managing applications, runtimes,
 * and WebVM instances in the browser environment.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Server, Package, Settings, Activity, AlertCircle } from 'lucide-react';
import { useApplicationServer } from '@/hooks/useApplicationServer';
import { Application, ApplicationStatus, CreateApplicationRequest } from '@/types/application-server';
import { ApplicationList } from '@/components/application-server/ApplicationList';
import { ApplicationDetails } from '@/components/application-server/ApplicationDetails';
import { RuntimeManager } from '@/components/application-server/RuntimeManager';
import { CreateApplicationModal } from '@/components/application-server/CreateApplicationModal';
import { EditApplicationModal } from '@/components/application-server/EditApplicationModal';

export function ApplicationServer() {
  const [activeTab, setActiveTab] = useState('applications');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const {
    applications,
    runtimes,
    webvm,
    loading,
    error,
    refreshData,
    createApplication,
    updateApplication,
    startApplication,
    stopApplication,
    deleteApplication
  } = useApplicationServer();

  // Handle application creation from modal
  const handleCreateApplication = async (request: CreateApplicationRequest) => {
    await createApplication(request);
    setActiveTab('applications'); // Switch to applications tab to show the new app
  };

  // Handle application editing
  const handleEditApplication = (application: Application) => {
    setEditingApplication(application);
    setShowEditModal(true);
  };

  // Handle application update from edit modal
  const handleUpdateApplication = async (id: string, request: any) => {
    await updateApplication(id, request);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Application Server</h2>
          <p className="text-muted-foreground">
            Manage and deploy applications using WebVM browser virtualization
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowCreateModal(true)} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
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
      )}

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{applications.length}</div>
                <p className="text-xs text-muted-foreground">
                  {applications.filter(app => app.status === ApplicationStatus.RUNNING).length} running
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Runtimes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{runtimes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Available environments
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebVM Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  <Badge variant={webvm?.status === 'ready' ? 'default' : 'secondary'}>
                    {webvm?.status || 'Unknown'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {webvm ? 'Instance available' : 'No instance'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {webvm?.memoryUsage || 0} MB
                </div>
                <p className="text-xs text-muted-foreground">
                  of {webvm?.config?.memoryLimit || 512} MB available
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="runtimes">Runtimes</TabsTrigger>
          <TabsTrigger value="webvm">WebVM</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="applications" className="space-y-4">
          {selectedApplication ? (
            <ApplicationDetails 
              application={selectedApplication}
              onClose={() => setSelectedApplication(null)}
              onEdit={(app) => {
                // TODO: Open edit application modal
                console.log('Edit application:', app);
              }}
            />
          ) : (
            <ApplicationList 
              applications={applications}
              loading={loading}
              error={error}
              onCreateApplication={() => setShowCreateModal(true)}
              onViewApplication={(app) => {
                setSelectedApplication(app);
              }}
              onEditApplication={handleEditApplication}
              onStartApplication={startApplication}
              onStopApplication={stopApplication}
              onDeleteApplication={deleteApplication}
            />
          )}
        </TabsContent>
        
        <TabsContent value="runtimes" className="space-y-4">
          <RuntimeManager 
            onSelectRuntime={(runtime) => {
              // TODO: Show runtime details or configure runtime
              console.log('Selected runtime:', runtime);
            }}
          />
        </TabsContent>
        
        <TabsContent value="webvm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WebVM Instance</CardTitle>
              <CardDescription>
                Monitor and manage the browser-based virtual machine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Instance Status</h4>
                    <p className="text-sm text-muted-foreground">WebVM is ready to host applications</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Ready</Badge>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">0 MB</div>
                    <p className="text-sm text-muted-foreground">Memory Used</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-sm text-muted-foreground">Active Apps</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-sm text-muted-foreground">Snapshots</p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline">Initialize</Button>
                  <Button variant="outline">Reset</Button>
                  <Button variant="outline">Create Snapshot</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                Track application deployments and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <Package className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">No deployments yet</h3>
                  <p className="text-muted-foreground">
                    Deploy an application to see deployment history
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Application Modal */}
      <CreateApplicationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateApplication}
        runtimes={runtimes}
        loading={loading}
      />

      {/* Edit Application Modal */}
      <EditApplicationModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingApplication(null);
        }}
        application={editingApplication}
        onSubmit={handleUpdateApplication}
        onStart={startApplication}
        onStop={stopApplication}
        runtimes={runtimes}
        loading={loading}
      />
    </div>
  );
}