/**
 * useApplicationServer Hook - State management for Application Server
 * 
 * Provides React state management and API integration for the Application Server
 * feature, including applications, runtimes, WebVM, and deployments.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Application, 
  RuntimeEnvironment, 
  WebVMInstance,
  ApplicationDeployment,
  CreateApplicationRequest,
  UpdateApplicationRequest,
  ApplicationServerError,
  WebVMStatus,
  ApplicationStatus
} from '@/types/application-server';

interface UseApplicationServerReturn {
  // State
  applications: Application[];
  runtimes: RuntimeEnvironment[];
  webvm: WebVMInstance | null;
  deployments: ApplicationDeployment[];
  loading: boolean;
  error: ApplicationServerError | null;
  
  // Application management
  createApplication: (request: CreateApplicationRequest) => Promise<Application>;
  updateApplication: (id: string, request: UpdateApplicationRequest) => Promise<Application>;
  deleteApplication: (id: string) => Promise<void>;
  startApplication: (id: string) => Promise<Application>;
  stopApplication: (id: string) => Promise<Application>;
  
  // Runtime management
  listRuntimes: () => Promise<RuntimeEnvironment[]>;
  installRuntime: (runtimeId: string) => Promise<RuntimeEnvironment>;
  
  // WebVM management
  getWebVMStatus: () => Promise<WebVMInstance>;
  initializeWebVM: (config?: any) => Promise<WebVMInstance>;
  resetWebVM: () => Promise<WebVMInstance>;
  
  // Data refresh
  refreshData: () => Promise<void>;
}

export function useApplicationServer(): UseApplicationServerReturn {
  const [applications, setApplications] = useState<Application[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeEnvironment[]>([]);
  const [webvm, setWebvm] = useState<WebVMInstance | null>(null);
  const [deployments, setDeployments] = useState<ApplicationDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApplicationServerError | null>(null);

  // API call wrapper with error handling
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> => {
    try {
      setError(null);
      return await operation();
    } catch (err: any) {
      const applicationError = new ApplicationServerError({
        code: err.code || 'UNKNOWN',
        message: err.message || errorMessage,
        details: err,
        timestamp: new Date()
      });
      setError(applicationError);
      throw applicationError;
    }
  }, []);

  // Load applications
  const loadApplications = useCallback(async () => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/applications');
      if (!response.ok) {
        throw new Error(`Failed to load applications: ${response.statusText}`);
      }
      const data = await response.json();
      setApplications(data.applications || []);
      return data.applications || [];
    }, 'Failed to load applications');
  }, [withErrorHandling]);

  // Load runtimes
  const loadRuntimes = useCallback(async () => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/runtimes');
      if (!response.ok) {
        throw new Error(`Failed to load runtimes: ${response.statusText}`);
      }
      const data = await response.json();
      setRuntimes(data.runtimes || []);
      return data.runtimes || [];
    }, 'Failed to load runtimes');
  }, [withErrorHandling]);

  // Load WebVM status
  const loadWebVMStatus = useCallback(async () => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/debug/webvm/status');
      if (!response.ok) {
        throw new Error(`Failed to load WebVM status: ${response.statusText}`);
      }
      const data = await response.json();
      setWebvm(data);
      return data;
    }, 'Failed to load WebVM status');
  }, [withErrorHandling]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null); // Clear any previous errors
    
    // Load each API independently to avoid Promise.all failing if one fails
    const results = await Promise.allSettled([
      loadApplications().catch(err => ({ error: err, type: 'applications' })),
      loadRuntimes().catch(err => ({ error: err, type: 'runtimes' })),
      loadWebVMStatus().catch(err => ({ error: err, type: 'webvm' }))
    ]);

    // Check if all succeeded - if any failed, keep the last error
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, index }) => ({
        type: ['applications', 'runtimes', 'webvm'][index],
        error: (result as PromiseRejectedResult).reason
      }));

    if (failures.length > 0) {
      // Set error to the most critical failure (prioritize WebVM > Applications > Runtimes)
      const criticalFailure = failures.find(f => f.type === 'webvm') || 
                              failures.find(f => f.type === 'applications') || 
                              failures[0];
      setError(criticalFailure.error);
    }

    setLoading(false);
  }, [loadApplications, loadRuntimes, loadWebVMStatus]);

  // Application management functions
  const createApplication = useCallback(async (request: CreateApplicationRequest): Promise<Application> => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create application: ${response.statusText}`);
      }
      
      const application = await response.json();
      setApplications(prev => [...prev, application]);
      return application;
    }, 'Failed to create application');
  }, [withErrorHandling]);

  const updateApplication = useCallback(async (id: string, request: UpdateApplicationRequest): Promise<Application> => {
    return withErrorHandling(async () => {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update application: ${response.statusText}`);
      }
      
      const application = await response.json();
      setApplications(prev => prev.map(app => app.id === id ? application : app));
      return application;
    }, 'Failed to update application');
  }, [withErrorHandling]);

  const deleteApplication = useCallback(async (id: string): Promise<void> => {
    return withErrorHandling(async () => {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete application: ${response.statusText}`);
      }
      
      setApplications(prev => prev.filter(app => app.id !== id));
    }, 'Failed to delete application');
  }, [withErrorHandling]);

  const startApplication = useCallback(async (id: string): Promise<Application> => {
    return withErrorHandling(async () => {
      const response = await fetch(`/api/applications/${id}/start`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start application: ${response.statusText}`);
      }
      
      const application = await response.json();
      setApplications(prev => prev.map(app => app.id === id ? application : app));
      return application;
    }, 'Failed to start application');
  }, [withErrorHandling]);

  const stopApplication = useCallback(async (id: string): Promise<Application> => {
    return withErrorHandling(async () => {
      const response = await fetch(`/api/applications/${id}/stop`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to stop application: ${response.statusText}`);
      }
      
      const application = await response.json();
      setApplications(prev => prev.map(app => app.id === id ? application : app));
      return application;
    }, 'Failed to stop application');
  }, [withErrorHandling]);

  // Runtime management functions
  const listRuntimes = useCallback(async (): Promise<RuntimeEnvironment[]> => {
    return loadRuntimes();
  }, [loadRuntimes]);

  const installRuntime = useCallback(async (runtimeId: string): Promise<RuntimeEnvironment> => {
    return withErrorHandling(async () => {
      const response = await fetch(`/api/runtimes/${runtimeId}/install`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install runtime: ${response.statusText}`);
      }
      
      const runtime = await response.json();
      setRuntimes(prev => prev.map(rt => rt.id === runtimeId ? runtime : rt));
      return runtime;
    }, 'Failed to install runtime');
  }, [withErrorHandling]);

  // WebVM management functions
  const getWebVMStatus = useCallback(async (): Promise<WebVMInstance> => {
    return loadWebVMStatus();
  }, [loadWebVMStatus]);

  const initializeWebVM = useCallback(async (config?: any): Promise<WebVMInstance> => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/debug/webvm/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config || {})
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize WebVM: ${response.statusText}`);
      }
      
      const instance = await response.json();
      setWebvm(instance);
      return instance;
    }, 'Failed to initialize WebVM');
  }, [withErrorHandling]);

  const resetWebVM = useCallback(async (): Promise<WebVMInstance> => {
    return withErrorHandling(async () => {
      const response = await fetch('/api/debug/webvm/reset', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset WebVM: ${response.statusText}`);
      }
      
      const instance = await response.json();
      setWebvm(instance);
      return instance;
    }, 'Failed to reset WebVM');
  }, [withErrorHandling]);

  // Load initial data with Application Server readiness check
  useEffect(() => {
    const loadDataWithRetry = async () => {
      // Wait for Application Server services to be ready before making API calls
      let attempts = 0;
      const maxAttempts = 20; // Increase attempts since services need more time
      
      console.log('🔄 Waiting for Application Server services to initialize...');
      
      while (attempts < maxAttempts) {
        try {
          // Test if Application Server services are ready
          const healthResponse = await fetch('/api/debug/application-server/health', { method: 'GET' });
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            if (healthData.ready) {
              console.log('✅ Application Server services ready, loading data...');
              await refreshData();
              break;
            }
          }
        } catch (error) {
          // Services not ready yet, wait and retry
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Shorter wait time, more attempts
        } else {
          console.warn('⚠️ Application Server services not ready after maximum attempts, trying anyway...');
          // Final attempt - try refreshData anyway
          await refreshData();
        }
      }
    };
    
    loadDataWithRetry();
  }, [refreshData]);

  return {
    // State
    applications,
    runtimes,
    webvm,
    deployments,
    loading,
    error,
    
    // Application management
    createApplication,
    updateApplication,
    deleteApplication,
    startApplication,
    stopApplication,
    
    // Runtime management
    listRuntimes,
    installRuntime,
    
    // WebVM management
    getWebVMStatus,
    initializeWebVM,
    resetWebVM,
    
    // Data refresh
    refreshData
  };
}