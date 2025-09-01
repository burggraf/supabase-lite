import { useState, useEffect } from 'react';

interface HealthCheckResult {
  isHealthy: boolean;
  healthError?: string;
  hasNorthwindData?: boolean;
  northwindError?: string;
  supabaseUrl?: string;
}

export function useHealthCheck() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult>({
    isHealthy: true,
    hasNorthwindData: true
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function runHealthChecks() {
      setIsChecking(true);
      
      // Get the current Supabase URL from localStorage or use default
      const savedUrl = localStorage.getItem('supabase-lite-url');
      const supabaseUrl = savedUrl || 'http://localhost:5173';
      
      const result: HealthCheckResult = {
        isHealthy: true,
        hasNorthwindData: true,
        supabaseUrl
      };

      try {
        // Health check
        const healthResponse = await fetch(`${supabaseUrl}/health`);
        if (!healthResponse.ok) {
          result.isHealthy = false;
          result.healthError = `Health check failed (${healthResponse.status}). Please check your Settings and ensure a browser tab is open to ${supabaseUrl}`;
        }
      } catch {
        result.isHealthy = false;
        result.healthError = `Unable to connect to Supabase Lite at ${supabaseUrl}. Please check your Settings and ensure a browser tab is open to ${supabaseUrl}`;
      }

      try {
        // Database schema check - look for products table
        const productsResponse = await fetch(`${supabaseUrl}/rest/v1/products?limit=1`);
        
        if (!productsResponse.ok) {
          const errorData = await productsResponse.json();
          
          // Check for specific "relation does not exist" error
          if (errorData.code === '42P01' && errorData.message?.includes('products')) {
            result.hasNorthwindData = false;
            result.northwindError = 'Northwind Database data not found. You need to install the sample data.';
          } else {
            // Other database errors
            result.hasNorthwindData = false;
            result.northwindError = `Database error: ${errorData.message || 'Unknown error'}`;
          }
        }
      } catch {
        result.hasNorthwindData = false;
        result.northwindError = 'Unable to check database schema. Connection may be unavailable.';
      }

      setHealthStatus(result);
      setIsChecking(false);
    }

    runHealthChecks();
  }, []);

  const refetchHealth = () => {
    setIsChecking(true);
    // Re-run the effect by updating a dependency or manually calling runHealthChecks
    const runHealthChecks = async () => {
      const savedUrl = localStorage.getItem('supabase-lite-url');
      const supabaseUrl = savedUrl || 'http://localhost:5173';
      
      const result: HealthCheckResult = {
        isHealthy: true,
        hasNorthwindData: true,
        supabaseUrl
      };

      try {
        const healthResponse = await fetch(`${supabaseUrl}/health`);
        if (!healthResponse.ok) {
          result.isHealthy = false;
          result.healthError = `Health check failed (${healthResponse.status}). Please check your Settings and ensure a browser tab is open to ${supabaseUrl}`;
        }
      } catch {
        result.isHealthy = false;
        result.healthError = `Unable to connect to Supabase Lite at ${supabaseUrl}. Please check your Settings and ensure a browser tab is open to ${supabaseUrl}`;
      }

      try {
        const productsResponse = await fetch(`${supabaseUrl}/rest/v1/products?limit=1`);
        
        if (!productsResponse.ok) {
          const errorData = await productsResponse.json();
          
          if (errorData.code === '42P01' && errorData.message?.includes('products')) {
            result.hasNorthwindData = false;
            result.northwindError = 'Northwind Database data not found. You need to install the sample data.';
          } else {
            result.hasNorthwindData = false;
            result.northwindError = `Database error: ${errorData.message || 'Unknown error'}`;
          }
        }
      } catch {
        result.hasNorthwindData = false;
        result.northwindError = 'Unable to check database schema. Connection may be unavailable.';
      }

      setHealthStatus(result);
      setIsChecking(false);
    };

    runHealthChecks();
  };

  return {
    healthStatus,
    isChecking,
    refetchHealth
  };
}