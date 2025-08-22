import { useState } from 'react';
import { testCategories, executeApiTest } from '../lib/api-tests';
import { TestButton } from './TestButton';
import { ResponseDisplay } from './ResponseDisplay';
import { RequestDetails } from './RequestDetails';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { ApiTest, ApiResponse } from '../lib/api-tests';

export function ApiTesting() {
  const [responses, setResponses] = useState<Record<string, ApiResponse>>({});
  const [selectedTest, setSelectedTest] = useState<ApiTest | null>(null);
  const [activeResponse, setActiveResponse] = useState<ApiResponse | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['basic-crud']));
  const [isRunningAll, setIsRunningAll] = useState(false);

  const handleTestResponse = (testId: string, response: ApiResponse) => {
    setResponses(prev => ({ ...prev, [testId]: response }));
    setActiveResponse(response);
    
    // Find the test by ID to set as selected
    const test = testCategories.flatMap(cat => cat.tests).find(t => t.id === testId);
    if (test) {
      setSelectedTest(test);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleTestClick = (test: ApiTest) => {
    setSelectedTest(test);
    const existingResponse = responses[test.id];
    if (existingResponse) {
      setActiveResponse(existingResponse);
    } else {
      setActiveResponse(null);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    const allTests = testCategories.flatMap(cat => cat.tests);
    
    for (const test of allTests) {
      try {
        const response = await executeApiTest(test);
        setResponses(prev => ({ ...prev, [test.id]: response }));
        // Small delay between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to execute test ${test.id}:`, error);
      }
    }
    setIsRunningAll(false);
  };

  const getTestStats = () => {
    const allTests = testCategories.flatMap(cat => cat.tests);
    const completedTests = Object.keys(responses).length;
    const successfulTests = Object.values(responses).filter(r => r.status >= 200 && r.status < 300).length;
    const failedTests = Object.values(responses).filter(r => r.status === 0 || r.status >= 400).length;
    
    return { total: allTests.length, completed: completedTests, successful: successfulTests, failed: failedTests };
  };

  const stats = getTestStats();

  return (
    <div className="h-screen flex flex-col">
      {/* Instructions and Notice */}
      <div className="p-4 border-b space-y-3">
        <Alert variant="warning">
          <AlertDescription>
            <strong>Prerequisites:</strong> 
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Open the main Supabase Lite app at <a href="http://localhost:5175" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">localhost:5175</a> to initialize the database connection</li>
              <li>Load the Northwind database from the Database tab → Seed Data section</li>
              <li>Return here to run comprehensive API tests on the Northwind data</li>
            </ol>
          </AlertDescription>
        </Alert>
        
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
          <strong>About this test suite:</strong> This professional API testing interface demonstrates all PostgREST capabilities including CRUD operations, 
          complex filtering, relationship queries, pagination, and error handling using realistic business scenarios from the Northwind database.
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Test Categories */}
        <div className="w-1/3 border-r bg-gray-50 overflow-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">API Test Categories</h2>
              <Button 
                size="sm" 
                onClick={runAllTests} 
                disabled={isRunningAll}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunningAll ? 'Running...' : 'Run All'}
              </Button>
            </div>

            {/* Test Statistics */}
            <div className="bg-white rounded-lg p-3 mb-4 shadow-sm border">
              <div className="text-sm font-medium text-gray-700 mb-2">Test Progress</div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{stats.total} Total</Badge>
                <Badge variant="default">{stats.completed} Run</Badge>
                <Badge variant="success">{stats.successful} Success</Badge>
                {stats.failed > 0 && <Badge variant="destructive">{stats.failed} Failed</Badge>}
              </div>
            </div>
            
            <div className="space-y-2">
              {testCategories.map((category) => (
                <div key={category.id} className="border rounded-lg bg-white shadow-sm">
                  <button
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{category.name}</h3>
                        {(() => {
                          const categoryTests = category.tests;
                          const categoryResponses = categoryTests.filter(test => responses[test.id]);
                          const successfulInCategory = categoryResponses.filter(test => {
                            const response = responses[test.id];
                            return response.status >= 200 && response.status < 300;
                          }).length;
                          
                          if (categoryResponses.length > 0) {
                            return (
                              <Badge 
                                variant={successfulInCategory === categoryTests.length ? "success" : "secondary"}
                                className="text-xs"
                              >
                                {categoryResponses.length}/{categoryTests.length}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedCategories.has(category.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedCategories.has(category.id) && (
                    <div className="border-t">
                      <div className="p-4 space-y-3">
                        {category.tests.map((test) => (
                          <div key={test.id} onClick={() => handleTestClick(test)}>
                            <TestButton
                              test={test}
                              onResponse={handleTestResponse}
                              existingResponse={responses[test.id]}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Split between Request Details and Response */}
        <div className="flex-1 flex flex-col">
          {/* Request Details (Top) */}
          <div className="h-1/2 border-b">
            <div className="h-full">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h3 className="font-medium text-gray-900">Request Details</h3>
              </div>
              <RequestDetails test={selectedTest} />
            </div>
          </div>

          {/* Response Display (Bottom) */}
          <div className="h-1/2">
            <div className="h-full">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h3 className="font-medium text-gray-900">Response</h3>
              </div>
              <ResponseDisplay 
                response={activeResponse} 
                testName={selectedTest?.name}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}