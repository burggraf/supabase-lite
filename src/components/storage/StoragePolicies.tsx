import { Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function StoragePolicies() {
  // Placeholder policies data
  const policies = [
    {
      id: '1',
      name: 'Public Access',
      description: 'Allow public read access to all objects',
      command: 'SELECT',
      check: 'bucket_id = \'public\'',
      roles: ['public'],
      enabled: true
    },
    {
      id: '2', 
      name: 'User Upload',
      description: 'Allow authenticated users to upload files',
      command: 'INSERT',
      check: 'auth.uid() IS NOT NULL',
      roles: ['authenticated'],
      enabled: true
    },
    {
      id: '3',
      name: 'User Delete Own',
      description: 'Users can only delete their own files',
      command: 'DELETE', 
      check: 'auth.uid()::text = (storage.foldername(name))[1]',
      roles: ['authenticated'],
      enabled: false
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Storage Policies</h2>
          <p className="text-muted-foreground mt-1">
            Manage Row Level Security (RLS) policies for storage buckets
          </p>
        </div>
        <Button className="gap-2" disabled>
          <Plus className="h-4 w-4" />
          New Policy
        </Button>
      </div>

      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-base">{policy.name}</CardTitle>
                    <CardDescription>{policy.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                    {policy.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Button variant="ghost" size="sm" disabled>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div>
                    <span className="text-sm font-medium">Command:</span>
                    <Badge variant="outline" className="ml-2">
                      {policy.command}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Roles:</span>
                    <div className="inline-flex gap-1 ml-2">
                      {policy.roles.map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Check:</span>
                  <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                    {policy.check}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Storage Policies</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create custom RLS policies to control access to your storage buckets and objects.
              This feature is coming soon!
            </p>
            <Button variant="outline" disabled>
              Learn about RLS policies
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}