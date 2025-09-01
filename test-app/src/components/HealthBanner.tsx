import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { AlertTriangle, Database, ExternalLink, X } from "lucide-react";
import { useState } from "react";

interface HealthBannerProps {
  isHealthy: boolean;
  healthError?: string;
  hasNorthwindData?: boolean;
  northwindError?: string;
  supabaseUrl?: string;
  onRefresh?: () => void;
}

export function HealthBanner({
  isHealthy,
  healthError,
  hasNorthwindData,
  northwindError,
  supabaseUrl,
  onRefresh
}: HealthBannerProps) {
  const [isDismissedHealth, setIsDismissedHealth] = useState(false);
  const [isDismissedNorthwind, setIsDismissedNorthwind] = useState(false);

  const hasErrors = !isHealthy || !hasNorthwindData;
  
  if (!hasErrors) return null;

  return (
    <div className="space-y-3 mb-6">
      {/* Health Check Error Banner */}
      {!isHealthy && !isDismissedHealth && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              <AlertDescription className="space-y-3">
                <div>
                  <strong className="text-red-800">Health Check Failed</strong>
                  <p className="mt-1 text-red-700">{healthError}</p>
                </div>
                
                <div className="bg-red-100 p-3 rounded-md">
                  <p className="text-sm text-red-800 font-medium mb-2">To fix this issue:</p>
                  <ol className="text-sm text-red-700 space-y-1 list-decimal list-inside">
                    <li>Check your Settings tab and ensure the Supabase URL is correct</li>
                    <li>Make sure a browser tab is open to <code className="bg-red-200 px-1 rounded text-xs">{supabaseUrl}</code></li>
                    <li>Verify that Supabase Lite is running</li>
                  </ol>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRefresh}
                    className="bg-white hover:bg-red-50 border-red-300 text-red-700"
                  >
                    Retry Health Check
                  </Button>
                  {supabaseUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(supabaseUrl, '_blank')}
                      className="bg-white hover:bg-red-50 border-red-300 text-red-700"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open Supabase Lite
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissedHealth(true)}
              className="ml-2 h-8 w-8 p-0 hover:bg-red-100 text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      {/* Northwind Database Error Banner */}
      {!hasNorthwindData && !isDismissedNorthwind && (
        <Alert variant="warning" className="border-orange-500/50 bg-orange-50">
          <Database className="h-4 w-4" />
          <div className="flex items-start justify-between w-full">
            <div className="flex-1">
              <AlertDescription className="space-y-3">
                <div>
                  <strong className="text-orange-800">Northwind Database Not Found</strong>
                  <p className="mt-1 text-orange-700">{northwindError}</p>
                </div>
                
                <div className="bg-orange-100 p-3 rounded-md">
                  <p className="text-sm text-orange-800 font-medium mb-2">To install the Northwind Database:</p>
                  <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                    <li>Go to <code className="bg-orange-200 px-1 rounded text-xs">{supabaseUrl}</code></li>
                    <li>Navigate to <strong>Database</strong> → <strong>Seed Data</strong> → <strong>Northwind Database</strong></li>
                    <li>Click <strong>Load Data</strong> to install the sample database</li>
                    <li>Wait for the installation to complete, then refresh this page</li>
                  </ol>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRefresh}
                    className="bg-white hover:bg-orange-50 border-orange-300 text-orange-700"
                  >
                    Check Again
                  </Button>
                  {supabaseUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(supabaseUrl, '_blank')}
                      className="bg-white hover:bg-orange-50 border-orange-300 text-orange-700"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open Supabase Lite
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissedNorthwind(true)}
              className="ml-2 h-8 w-8 p-0 hover:bg-orange-100 text-orange-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}