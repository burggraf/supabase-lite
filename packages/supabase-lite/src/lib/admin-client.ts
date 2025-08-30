import axios, { AxiosResponse } from 'axios';
import { ConnectionConfig } from '../types/index.js';
import { UrlParser } from './url-parser.js';

export interface AdminProject {
  id: string;
  name: string;
  createdAt: string;
  lastAccessed: string;
  isActive: boolean;
}

export interface AdminError {
  error: string;
  message: string;
  details?: string;
}

export class AdminClient {
  private config: ConnectionConfig;

  constructor(url: string) {
    this.config = UrlParser.parse(url);
  }

  /**
   * List all projects on the server
   */
  async listProjects(): Promise<AdminProject[]> {
    try {
      const endpoint = this.getAdminEndpoint('projects');
      
      const response: AxiosResponse = await axios.get(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result = response.data;

      // Handle error responses
      if (result.error) {
        const error: AdminError = {
          error: result.error,
          message: result.message || 'Failed to list projects',
          details: result.details
        };
        throw new Error(error.message);
      }

      return result.projects || [];

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused. Make sure Supabase Lite is running at ${this.config.baseUrl}`
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            `Admin endpoint not found. Make sure you're connecting to a valid Supabase Lite instance`
          );
        } else if (error.response && error.response.status >= 500) {
          throw new Error(
            `Server error (${error.response.status}). The Supabase Lite instance may be experiencing issues`
          );
        } else if (error.response?.data?.error) {
          // This is an admin-specific error
          throw new Error(error.response.data.message || 'Admin request failed');
        }
        throw new Error(`Network error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(name: string): Promise<AdminProject> {
    try {
      const endpoint = this.getAdminEndpoint('projects');
      
      const response: AxiosResponse = await axios.post(
        endpoint,
        { name: name.trim() },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 second timeout for creation
        }
      );

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result = response.data;

      // Handle error responses
      if (result.error) {
        const error: AdminError = {
          error: result.error,
          message: result.message || 'Failed to create project',
          details: result.details
        };
        throw new Error(error.message);
      }

      return result.project;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused. Make sure Supabase Lite is running at ${this.config.baseUrl}`
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            `Admin endpoint not found. Make sure you're connecting to a valid Supabase Lite instance`
          );
        } else if (error.response?.status === 409) {
          throw new Error(
            'A project with this name already exists'
          );
        } else if (error.response && error.response.status >= 500) {
          throw new Error(
            `Server error (${error.response.status}). The Supabase Lite instance may be experiencing issues`
          );
        } else if (error.response?.data?.error) {
          // This is an admin-specific error
          throw new Error(error.response.data.message || 'Failed to create project');
        }
        throw new Error(`Network error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      const endpoint = this.getAdminEndpoint(`projects/${projectId}`);
      
      const response: AxiosResponse = await axios.delete(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout for deletion
      });

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result = response.data;

      // Handle error responses (if any content is returned)
      if (result && result.error) {
        const error: AdminError = {
          error: result.error,
          message: result.message || 'Failed to delete project',
          details: result.details
        };
        throw new Error(error.message);
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused. Make sure Supabase Lite is running at ${this.config.baseUrl}`
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            'Project not found'
          );
        } else if (error.response && error.response.status >= 500) {
          throw new Error(
            `Server error (${error.response.status}). The Supabase Lite instance may be experiencing issues`
          );
        } else if (error.response?.data?.error) {
          // This is an admin-specific error
          throw new Error(error.response.data.message || 'Failed to delete project');
        }
        throw new Error(`Network error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Test connection to the admin API
   */
  async ping(): Promise<boolean> {
    try {
      await this.listProjects();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the admin endpoint URL for the given path
   */
  private getAdminEndpoint(path: string): string {
    // Admin endpoints are always at the server level, never project-specific
    return `${this.config.baseUrl}/admin/${path}`;
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): ConnectionConfig {
    return { ...this.config };
  }
}