import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Users, Table, Clock, HardDrive, FileText, Code2, Globe } from 'lucide-react';
import { ProjectsSection } from './ProjectsSection';
import { projectManager } from '@/lib/projects/ProjectManager';
import { vfsManager } from '@/lib/vfs/VFSManager';
import type { Project } from '@/lib/projects/ProjectManager';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

interface ProjectMetrics {
  databaseSize: string;
  storageFileCount: number;
  storageTotalSize: string;
  edgeFunctionsCount: number;
  applicationsCount: number;
}

export function Dashboard({ onPageChange }: DashboardProps) {
  const { isConnected, isConnecting, error, getConnectionInfo, switchToProject, connectionId, getTableList, initialize, getDatabaseSize, executeQuery } = useDatabase();
  const connectionInfo = getConnectionInfo();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [tableCount, setTableCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics>({
    databaseSize: '0 B',
    storageFileCount: 0,
    storageTotalSize: '0 B',
    edgeFunctionsCount: 0,
    applicationsCount: 0,
  });
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const hasInitialized = useRef(false);

  // Load projects on component mount and create first project if none exist
  useEffect(() => {
    // Prevent multiple initializations (infinite loop protection)
    if (hasInitialized.current) {
      return;
    }

    const initializeProjects = async () => {
      hasInitialized.current = true;
      
      const allProjects = projectManager.getProjects();
      
      // If no projects exist, create a default one
      if (allProjects.length === 0) {
        try {
          setIsProjectsLoading(true);
          await projectManager.createProject('My First Project');
          
          // Let useDatabase hook handle initialization when it detects the active project
          // This prevents race condition between Dashboard and useDatabase initialization
          
          // Update state
          setProjects(projectManager.getProjects());
          setActiveProject(projectManager.getActiveProject());
        } catch (error) {
          console.error('🔍 Dashboard: Failed to create default project:', error);
        } finally {
          setIsProjectsLoading(false);
        }
      } else {
        // Load existing projects
        const active = projectManager.getActiveProject();
        setProjects(allProjects);
        setActiveProject(active);
        
        // Note: Database initialization is handled by useDatabase hook
        // We don't need to call switchToProject here as useDatabase hook
        // will automatically connect to the active project's database
      }
    };

    initializeProjects();
  }, []); // Empty dependency array to run only once

  // Update table count and project metrics when database connection changes
  useEffect(() => {
    const updateMetrics = async () => {
      if (isConnected && connectionId && getTableList) {
        try {
          const tables = await getTableList();
          setTableCount(tables.length);

          // Load project metrics and user count asynchronously
          loadProjectMetrics();
          loadUserCount();
        } catch (error) {
          console.error('🔍 Dashboard: failed to get table count:', error);
          setTableCount(0);
        }
      } else {
        setTableCount(0);
      }
    };

    updateMetrics();
  }, [isConnected, connectionId, getTableList, activeProject]);

  const handleCreateProject = async (name: string) => {
    setIsProjectsLoading(true);
    try {
      const newProject = await projectManager.createProject(name);
      
      // For NEW projects, initialize the database directly
      await initialize(newProject.databasePath);
      
      // Validate the initialization was successful
      const connectionInfo = getConnectionInfo();
      if (!connectionInfo || connectionInfo.id !== newProject.databasePath) {
        throw new Error('Failed to initialize new project database - connection mismatch');
      }
      
      
      // Refresh projects list
      setProjects(projectManager.getProjects());
      setActiveProject(projectManager.getActiveProject());
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setIsProjectsLoading(true);
    try {
      await projectManager.deleteProject(projectId);
      
      // Refresh projects list
      const updatedProjects = projectManager.getProjects();
      const updatedActiveProject = projectManager.getActiveProject();
      setProjects(updatedProjects);
      setActiveProject(updatedActiveProject);
      
      // Switch to the new active project's database if there is one
      if (updatedActiveProject && switchToProject) {
        await switchToProject(updatedActiveProject.databasePath);
      }
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    setIsProjectsLoading(true);
    try {
      const project = await projectManager.switchToProject(projectId);
      
      // Switch to the project's database with validation
      if (switchToProject) {
        await switchToProject(project.databasePath);
        
        // Validate the switch was successful
        const connectionInfo = getConnectionInfo();
        if (!connectionInfo || connectionInfo.id !== project.databasePath) {
          throw new Error(`Failed to switch to project database - expected ${project.databasePath}, got ${connectionInfo?.id}`);
        }
        
      }
      
      // Refresh projects list
      setProjects(projectManager.getProjects());
      setActiveProject(projectManager.getActiveProject());
    } catch (error) {
      console.error('🏗️ Dashboard.handleSwitchProject failed:', error);
      throw error;
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const handleUpdateProjectName = async (projectId: string, newName: string) => {
    try {
      projectManager.updateProjectName(projectId, newName);
      
      // Refresh projects list
      setProjects(projectManager.getProjects());
      setActiveProject(projectManager.getActiveProject());
    } catch (error) {
      console.error('Failed to update project name:', error);
      throw error;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadProjectMetrics = async () => {
    if (!isConnected || !activeProject) return;

    setIsMetricsLoading(true);
    try {
      // Ensure VFS is initialized for the current project first
      await vfsManager.initialize(activeProject.id);

      const [databaseSize, buckets] = await Promise.all([
        getDatabaseSize(),
        vfsManager.listBuckets().catch(() => [])
      ]);

      // Update all bucket stats first to ensure current data
      await Promise.all(
        buckets.map(bucket => vfsManager.updateBucketStats(bucket.name))
      );

      // Get fresh bucket data with updated stats
      const freshBuckets = await vfsManager.listBuckets();

      // Get storage metrics from all buckets
      let totalFiles = 0;
      let totalSize = 0;
      let edgeFunctionsCount = 0;
      let applicationsCount = 0;

      for (const bucket of freshBuckets) {
        totalFiles += bucket.fileCount || 0;
        totalSize += bucket.totalSize || 0;

        // Count edge functions in edge-functions bucket
        if (bucket.name === 'edge-functions') {
          const functionFiles = await vfsManager.listFiles({ directory: 'edge-functions', recursive: true }).catch(() => []);
          const functionNames = new Set<string>();
          functionFiles.forEach(file => {
            const match = file.path.match(/^edge-functions\/([^\/]+)\/index\.ts$/);
            if (match) {
              functionNames.add(match[1]);
            }
          });
          edgeFunctionsCount = functionNames.size;
        }

        // Count applications in app bucket
        if (bucket.name === 'app') {
          const appFiles = await vfsManager.listFiles({ directory: 'app', recursive: true }).catch(() => []);
          const appNames = new Set<string>();
          appFiles.forEach(file => {
            const segments = file.path.split('/');
            if (segments.length >= 2 && segments[0] === 'app') {
              appNames.add(segments[1]);
            }
          });
          applicationsCount = appNames.size;
        }
      }

      setProjectMetrics({
        databaseSize,
        storageFileCount: totalFiles,
        storageTotalSize: formatBytes(totalSize),
        edgeFunctionsCount,
        applicationsCount,
      });
    } catch (error) {
      console.error('Failed to load project metrics:', error);
    } finally {
      setIsMetricsLoading(false);
    }
  };

  const loadUserCount = async () => {
    if (!isConnected || !executeQuery) return;

    try {
      const result = await executeQuery('SELECT COUNT(*) as usercount FROM auth.users');
      const count = result.rows[0] as { usercount: string };
      setUserCount(parseInt(count.usercount) || 0);
    } catch (error) {
      // Auth table might not exist yet or query might fail
      console.debug('Could not load user count:', error);
      setUserCount(0);
    }
  };

  const stats = [
    {
      title: "Database Status",
      value: isConnected ? "Connected" : "Disconnected",
      icon: Database,
      variant: isConnected ? "success" : "destructive",
    },
    {
      title: "Tables",
      value: tableCount.toString(),
      icon: Table,
    },
    {
      title: "Users",
      value: userCount.toString(),
      icon: Users,
    },
    {
      title: "Last Access",
      value: connectionInfo ? new Date(connectionInfo.lastAccessed).toLocaleTimeString() : "Never",
      icon: Clock,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-6 overflow-y-auto min-h-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to Supabase Lite - Your local PostgreSQL development environment
        </p>
      </div>

      <ProjectsSection
        projects={projects}
        activeProject={activeProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onSwitchProject={handleSwitchProject}
        onUpdateProjectName={handleUpdateProjectName}
        isLoading={isProjectsLoading}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.variant && (
                  <Badge variant={stat.variant as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"} className="mt-2">
                    {stat.variant === "success" ? "Online" : "Offline"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>
              Get started with your local Supabase development environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {isConnected ? "✅ Database Connected" : "❌ Database Disconnected"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {isConnected 
                  ? "PGlite is running in your browser with IndexedDB persistence"
                  : error 
                    ? `Database connection failed: ${error}`
                    : isConnecting 
                      ? "Connecting to database..."
                      : "Database connection failed - check console for errors"
                }
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">📝 Try the SQL Editor</h4>
              <p className="text-xs text-muted-foreground">
                Write and execute SQL queries against your local PostgreSQL database
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">🚀 Available Features</h4>
              <p className="text-xs text-muted-foreground">
                Auth, Storage, Edge Functions, and the Application Server are ready to use
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
            <CardDescription>
              {activeProject?.name || 'Unknown Project'} resource usage and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMetricsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                    </div>
                    <div className="h-4 w-12 bg-muted animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Database Size</span>
                  </div>
                  <span className="text-sm font-mono">{projectMetrics.databaseSize}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Storage Files</span>
                  </div>
                  <div className="text-sm font-mono">
                    {projectMetrics.storageFileCount} files ({projectMetrics.storageTotalSize})
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Edge Functions</span>
                  </div>
                  <span className="text-sm font-mono">{projectMetrics.edgeFunctionsCount}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Applications</span>
                  </div>
                  <span className="text-sm font-mono">{projectMetrics.applicationsCount}</span>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground text-center">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}