import { useState } from 'react';
import { testCategories, executeApiTest } from '../lib/api-tests';
import { TestButton } from './TestButton';
import { ResponseDisplay } from './ResponseDisplay';
import { RequestDetails } from './RequestDetails';
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
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-cyan-50 to-cyan-100">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">API Testing</h2>
            <p className="text-gray-600">Test all PostgREST endpoints with the Northwind database</p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Left Panel - Test Categories */}
        <div className="w-1/3 border-r bg-gray-50 overflow-auto max-h-screen">
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

        {/* Right Panel - Request Details and Response */}
        <div className="w-2/3 flex flex-col">
          {/* Request Details */}
          <div>
            <div className="bg-gray-100 px-4 py-2 border-b">
              <h3 className="font-medium text-gray-900">Request Details</h3>
            </div>
            <RequestDetails test={selectedTest} />
          </div>

          {/* Response Display */}
          <div>
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
  );
}