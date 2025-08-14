import { useDatabase } from '@/hooks/useDatabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Users, Table, Clock } from 'lucide-react';

export function Dashboard() {
  const { isConnected, getConnectionInfo } = useDatabase();
  const connectionInfo = getConnectionInfo();

  const stats = [
    {
      title: "Database Status",
      value: isConnected ? "Connected" : "Disconnected",
      icon: Database,
      badge: isConnected ? "success" : "destructive",
    },
    {
      title: "Tables",
      value: "2", // Will be dynamic later
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
    <div className="flex-1 space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to Supabase Lite - Your local PostgreSQL development environment
        </p>
      </div>

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
                  <Badge variant={stat.badge as any}>{stat.badge}</Badge>
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
              <h4 className="text-sm font-medium">✅ Database Connected</h4>
              <p className="text-xs text-muted-foreground">
                PGlite is running in your browser with IndexedDB persistence
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