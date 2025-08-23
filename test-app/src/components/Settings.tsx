import { ApiSettings } from './ApiSettings';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface SettingsProps {
  onSettingsChange: () => void;
}

export function Settings({ onSettingsChange }: SettingsProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">Configure your Supabase Lite test environment</p>
      </div>

      {/* API Server Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Server Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApiSettings onSettingsChange={onSettingsChange} />
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="warning">
            <AlertDescription>
              <strong>Before running API tests:</strong> 
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Configure the correct port above and test the connection</li>
                <li>Open the main Supabase Lite app to initialize the database connection</li>
                <li>Load the Northwind database from the Database tab → Seed Data section</li>
                <li>Navigate to the API Testing tab to run comprehensive tests</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About This Test Suite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg">
            <p className="leading-relaxed">
              This professional API testing interface demonstrates all PostgREST capabilities including CRUD operations, 
              complex filtering, relationship queries, pagination, and error handling using realistic business scenarios 
              from the Northwind database. The test suite validates the complete compatibility between Supabase Lite 
              and the official Supabase API specification.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}