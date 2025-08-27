import { Settings, Database, Shield, Globe, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function StorageSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Storage Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure global storage settings and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>
              Basic storage configuration options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-storage">Enable Storage Service</Label>
                <p className="text-sm text-muted-foreground">
                  Allow file upload and storage operations
                </p>
              </div>
              <Switch id="enable-storage" checked disabled />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-optimize">Auto-optimize Images</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically compress and optimize uploaded images
                </p>
              </div>
              <Switch id="auto-optimize" disabled />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="generate-thumbnails">Generate Thumbnails</Label>
                <p className="text-sm text-muted-foreground">
                  Create thumbnail versions for images
                </p>
              </div>
              <Switch id="generate-thumbnails" disabled />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Configure security and access control settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Row Level Security (RLS)</Label>
                <p className="text-sm text-muted-foreground">
                  Enable RLS for storage objects table
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>File Type Restrictions</Label>
                <p className="text-sm text-muted-foreground">
                  Global restrictions on file types
                </p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Configure
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Virus Scanning</Label>
                <p className="text-sm text-muted-foreground">
                  Scan uploaded files for malware
                </p>
              </div>
              <Badge variant="secondary">Pro Feature</Badge>
            </div>
          </CardContent>
        </Card>

        {/* CDN & Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle>CDN & Performance</CardTitle>
            </div>
            <CardDescription>
              Content delivery and performance optimization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable CDN</Label>
                <p className="text-sm text-muted-foreground">
                  Use CDN for faster file delivery globally
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Smart CDN</Label>
                <p className="text-sm text-muted-foreground">
                  Intelligent caching and cache invalidation
                </p>
              </div>
              <Badge variant="secondary">Pro Feature</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Image Transformations</Label>
                <p className="text-sm text-muted-foreground">
                  On-the-fly image resizing and format conversion
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Storage Limits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Storage Limits</CardTitle>
            </div>
            <CardDescription>
              Current usage and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span>2.3 GB / 8 GB</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ width: '29%' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bandwidth (this month)</span>
                <span>124 GB / 250 GB</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: '50%' }}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" disabled>
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}