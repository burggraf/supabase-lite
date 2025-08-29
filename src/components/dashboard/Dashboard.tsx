import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Users, Table, Clock } from 'lucide-react';
import { ProjectsSection } from './ProjectsSection';
import { projectManager } from '@/lib/projects/ProjectManager';
import type { Project } from '@/lib/projects/ProjectManager';

export function Dashboard() {
  const { isConnected, isConnecting, error, getConnectionInfo, switchToProject, connectionId, getTableList, initialize } = useDatabase();
  const connectionInfo = getConnectionInfo();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [tableCount, setTableCount] = useState(0);
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
          const defaultProject = await projectManager.createProject('My First Project');
          
          // Switch to the new project's database
          await switchToProject(defaultProject.databasePath);
          
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

  // Update table count when database connection changes
  useEffect(() => {
    const updateTableCount = async () => {
      if (isConnected && connectionId && getTableList) {
        try {
          const tables = await getTableList();
          setTableCount(tables.length);
        } catch (error) {
          console.error('🔍 Dashboard: failed to get table count:', error);
          setTableCount(0);
        }
      } else {
        setTableCount(0);
      }
    };

    updateTableCount();
  }, [isConnected, connectionId, getTableList]);

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

  const stats = [
    {
      title: "Database Status",
      value: isConnected ? "Connected" : "Disconnected",
      icon: Database,
      badge: isConnected ? "success" : "destructive",
    },
    {
      title: "Tables",
      value: tableCount.toString(),
      icon: Table,
      badge: "secondary",
    },
    {
      title: "Sample Users",
      value: "0", // Will be dynamic later
      icon: Users,
      badge: "secondary",
    },
    {
      title: "Last Access",
      value: connectionInfo ? new Date(connectionInfo.lastAccessed).toLocaleTimeString() : "Never",
      icon: Clock,
      badge: "secondary",
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
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <Badge variant={stat.badge as "default" | "secondary" | "destructive" | "outline"}>{stat.badge}</Badge>
                </div>
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
              <h4 className="text-sm font-medium">🚀 More Features Coming</h4>
              <p className="text-xs text-muted-foreground">
                Auth, Storage, Realtime, and Edge Functions are in development
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Info</CardTitle>
            <CardDescription>
              Current database connection details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectionInfo ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{connectionInfo.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs">{connectionInfo.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(connectionInfo.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="success">Active</Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No connection info available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}