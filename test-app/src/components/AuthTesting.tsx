import { useState, useEffect } from 'react';
import { authTestCategories, executeAuthTest, clearAuthData, AUTH_STORAGE_KEYS } from '../lib/auth-tests';
import { AuthTestButton } from './AuthTestButton';
import { ResponseDisplay } from './ResponseDisplay';
import { RequestDetails } from './RequestDetails';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import type { AuthTest, AuthResponse } from '../lib/auth-tests';

interface AuthState {
  isAuthenticated: boolean;
  user: any;
  session: any;
  accessToken: string | null;
  refreshToken: string | null;
}

export function AuthTesting() {
  const [responses, setResponses] = useState<Record<string, AuthResponse>>({});
  const [selectedTest, setSelectedTest] = useState<AuthTest | null>(null);
  const [activeResponse, setActiveResponse] = useState<AuthResponse | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['basic-auth']));
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    session: null,
    accessToken: null,
    refreshToken: null
  });

  // Update auth state from localStorage
  const updateAuthState = () => {
    const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    const userStr = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    const sessionStr = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION);

    let user = null;
    let session = null;

    try {
      if (userStr) user = JSON.parse(userStr);
      if (sessionStr) session = JSON.parse(sessionStr);
    } catch (e) {
      console.error('Error parsing stored auth data:', e);
    }

    setAuthState({
      isAuthenticated: !!accessToken,
      user,
      session,
      accessToken,
      refreshToken
    });
  };

  useEffect(() => {
    updateAuthState();
    
    // Listen for storage changes to update auth state
    const handleStorageChange = () => {
      updateAuthState();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for localStorage changes within the same tab
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, [key, value]);
      if (Object.values(AUTH_STORAGE_KEYS).includes(key as any)) {
        setTimeout(updateAuthState, 0);
      }
    };
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      localStorage.setItem = originalSetItem;
    };
  }, []);

  const handleTestResponse = (testId: string, response: AuthResponse) => {
    setResponses(prev => ({ ...prev, [testId]: response }));
    setActiveResponse(response);
    
    // Find the test by ID to set as selected
    const test = authTestCategories.flatMap(cat => cat.tests).find(t => t.id === testId);
    if (test) {
      setSelectedTest(test);
    }
    
    // Update auth state after response
    setTimeout(updateAuthState, 100);
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

  const handleTestClick = (test: AuthTest) => {
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
    const allTests = authTestCategories.flatMap(cat => cat.tests);
    
    for (const test of allTests) {
      // Skip admin tests if not authenticated or tests that require auth when not authenticated
      if ((test.adminOnly && !authState.isAuthenticated) || 
          (test.requiresAuth && !authState.isAuthenticated && !test.id.includes('signin') && !test.id.includes('signup'))) {
        continue;
      }
      
      try {
        const response = await executeAuthTest(test);
        setResponses(prev => ({ ...prev, [test.id]: response }));
        // Update auth state after each auth-modifying test
        if (test.id.includes('signin') || test.id.includes('signup') || test.id.includes('logout')) {
          setTimeout(updateAuthState, 100);
        }
        // Small delay between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to execute test ${test.id}:`, error);
      }
    }
    setIsRunningAll(false);
  };

  const handleClearAuthData = () => {
    clearAuthData();
    updateAuthState();
    // Clear auth-related responses
    const authTestIds = authTestCategories.flatMap(cat => cat.tests).map(t => t.id);
    setResponses(prev => {
      const newResponses = { ...prev };
      authTestIds.forEach(id => delete newResponses[id]);
      return newResponses;
    });
    setActiveResponse(null);
  };

  const getTestStats = () => {
    const allTests = authTestCategories.flatMap(cat => cat.tests);
    const completedTests = Object.keys(responses).length;
    const successfulTests = Object.values(responses).filter(r => r.status >= 200 && r.status < 300).length;
    const failedTests = Object.values(responses).filter(r => r.status === 0 || r.status >= 400).length;
    
    return { total: allTests.length, completed: completedTests, successful: successfulTests, failed: failedTests };
  };

  const stats = getTestStats();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-100">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Authentication Testing</h2>
            <p className="text-gray-600">Comprehensive testing of all Supabase Auth API endpoints</p>
          </div>
        </div>
      </div>

      {/* Auth State Display */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Authentication Status</h3>
          {authState.isAuthenticated && (
            <Button size="sm" variant="outline" onClick={handleClearAuthData}>
              Clear Auth Data
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${authState.isAuthenticated ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium">
                {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>
            {authState.user && (
              <div className="mt-2 text-xs text-gray-600">
                <div>Email: {authState.user.email || 'N/A'}</div>
                <div>Phone: {authState.user.phone || 'N/A'}</div>
                <div>ID: {authState.user.id}</div>
              </div>
            )}
          </Card>
          
          <Card className="p-3">
            <div className="text-sm font-medium mb-1">Access Token</div>
            <div className="text-xs font-mono bg-gray-100 p-1 rounded">
              {authState.accessToken ? 
                `${authState.accessToken.substring(0, 20)}...` : 
                'None'
              }
            </div>
          </Card>
          
          <Card className="p-3">
            <div className="text-sm font-medium mb-1">Session Info</div>
            <div className="text-xs text-gray-600">
              {authState.session ? (
                <div>
                  <div>Expires: {new Date(authState.session.expires_at * 1000).toLocaleString()}</div>
                  <div>Role: {authState.session.user?.role || 'N/A'}</div>
                </div>
              ) : (
                'No active session'
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Left Panel - Test Categories */}
        <div className="w-1/3 border-r bg-gray-50 overflow-auto max-h-screen">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Auth Test Categories</h2>
              <Button 
                size="sm" 
                onClick={runAllTests} 
                disabled={isRunningAll}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunningAll ? 'Running...' : 'Run Available'}
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
              {authTestCategories.map((category) => (
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
                            <AuthTestButton
                              test={test}
                              onResponse={handleTestResponse}
                              existingResponse={responses[test.id]}
                              authState={authState}
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
            <RequestDetails test={selectedTest as any} />
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