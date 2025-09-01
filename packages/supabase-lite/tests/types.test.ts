import { describe, it, expect } from 'vitest';
import type {
  ConnectionConfig,
  QueryResult,
  QueryField,
  QueryError,
  MetaCommandResult,
  ReplOptions,
  MetaCommand,
  FileExecutionSummary,
  AdminProject,
  AdminError,
  AdminResponse
} from '../src/types/index.js';

describe('TypeScript Types', () => {
  describe('ConnectionConfig', () => {
    it('should define ConnectionConfig interface correctly', () => {
      const config: ConnectionConfig = {
        url: 'http://localhost:5173',
        baseUrl: 'http://localhost:5173'
      };

      expect(config.url).toBe('http://localhost:5173');
      expect(config.baseUrl).toBe('http://localhost:5173');
      expect(config.projectId).toBeUndefined();
    });

    it('should allow optional projectId', () => {
      const configWithProject: ConnectionConfig = {
        url: 'https://myproject.supabase.co',
        projectId: 'myproject',
        baseUrl: 'https://myproject.supabase.co'
      };

      expect(configWithProject.projectId).toBe('myproject');
    });

    it('should require url and baseUrl', () => {
      // These should compile correctly
      const minimalConfig: ConnectionConfig = {
        url: 'test',
        baseUrl: 'test'
      };

      expect(minimalConfig.url).toBeDefined();
      expect(minimalConfig.baseUrl).toBeDefined();
    });
  });

  describe('QueryResult', () => {
    it('should define QueryResult interface correctly', () => {
      const result: QueryResult = {
        data: [{ id: 1, name: 'test' }],
        rowCount: 1,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'text' }
        ]
      };

      expect(result.data).toHaveLength(1);
      expect(result.rowCount).toBe(1);
      expect(result.fields).toHaveLength(2);
      expect(result.executionTime).toBeUndefined();
    });

    it('should allow optional executionTime', () => {
      const result: QueryResult = {
        data: [],
        rowCount: 0,
        fields: [],
        executionTime: 123.45
      };

      expect(result.executionTime).toBe(123.45);
    });

    it('should handle empty results', () => {
      const emptyResult: QueryResult = {
        data: [],
        rowCount: 0,
        fields: []
      };

      expect(emptyResult.data).toHaveLength(0);
      expect(emptyResult.rowCount).toBe(0);
      expect(emptyResult.fields).toHaveLength(0);
    });

    it('should handle complex data structures', () => {
      const complexResult: QueryResult = {
        data: [
          { 
            id: 1, 
            user: { name: 'John', email: 'john@example.com' },
            tags: ['admin', 'user'],
            metadata: { createdAt: '2024-01-01', isActive: true }
          }
        ],
        rowCount: 1,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'user', type: 'jsonb' },
          { name: 'tags', type: 'text[]' },
          { name: 'metadata', type: 'jsonb' }
        ],
        executionTime: 15.7
      };

      expect(complexResult.data[0].user.name).toBe('John');
      expect(complexResult.data[0].tags).toContain('admin');
      expect(complexResult.fields).toHaveLength(4);
    });
  });

  describe('QueryField', () => {
    it('should define QueryField interface correctly', () => {
      const field: QueryField = {
        name: 'column_name',
        type: 'varchar'
      };

      expect(field.name).toBe('column_name');
      expect(field.type).toBe('varchar');
    });

    it('should handle various PostgreSQL types', () => {
      const fields: QueryField[] = [
        { name: 'id', type: 'uuid' },
        { name: 'name', type: 'text' },
        { name: 'age', type: 'integer' },
        { name: 'score', type: 'decimal' },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'timestamp with time zone' },
        { name: 'tags', type: 'text[]' },
        { name: 'data', type: 'jsonb' }
      ];

      expect(fields).toHaveLength(8);
      fields.forEach(field => {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
        expect(typeof field.name).toBe('string');
        expect(typeof field.type).toBe('string');
      });
    });
  });

  describe('QueryError', () => {
    it('should define QueryError interface correctly', () => {
      const error: QueryError = {
        error: 'syntax_error',
        message: 'Syntax error in SQL statement'
      };

      expect(error.error).toBe('syntax_error');
      expect(error.message).toBe('Syntax error in SQL statement');
      expect(error.details).toBeUndefined();
      expect(error.hint).toBeUndefined();
    });

    it('should allow optional details and hint', () => {
      const detailedError: QueryError = {
        error: 'relation_not_found',
        message: 'relation "users" does not exist',
        details: 'The table "users" was not found in the current schema',
        hint: 'Try creating the table first or check your schema'
      };

      expect(detailedError.details).toBeDefined();
      expect(detailedError.hint).toBeDefined();
    });

    it('should handle various error types', () => {
      const errors: QueryError[] = [
        {
          error: 'permission_denied',
          message: 'permission denied for table users'
        },
        {
          error: 'duplicate_key',
          message: 'duplicate key value violates unique constraint',
          details: 'Key (email)=(test@example.com) already exists.'
        },
        {
          error: 'data_type_mismatch',
          message: 'column "age" is of type integer but expression is of type text',
          hint: 'You will need to rewrite or cast the expression.'
        }
      ];

      errors.forEach(error => {
        expect(error.error).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.error).toBe('string');
        expect(typeof error.message).toBe('string');
      });
    });
  });

  describe('MetaCommandResult', () => {
    it('should define MetaCommandResult with success type', () => {
      const result: MetaCommandResult = {
        type: 'success',
        message: 'Command executed successfully'
      };

      expect(result.type).toBe('success');
      expect(result.message).toBe('Command executed successfully');
    });

    it('should define MetaCommandResult with error type', () => {
      const result: MetaCommandResult = {
        type: 'error',
        message: 'Command failed'
      };

      expect(result.type).toBe('error');
      expect(result.message).toBe('Command failed');
    });

    it('should define MetaCommandResult with exit type', () => {
      const result: MetaCommandResult = {
        type: 'exit'
      };

      expect(result.type).toBe('exit');
      expect(result.message).toBeUndefined();
    });

    it('should allow data and fields for success results', () => {
      const result: MetaCommandResult = {
        type: 'success',
        message: 'Tables listed successfully',
        data: [
          { table_name: 'users', table_schema: 'public' },
          { table_name: 'posts', table_schema: 'public' }
        ],
        fields: [
          { name: 'table_name', type: 'text' },
          { name: 'table_schema', type: 'text' }
        ]
      };

      expect(result.data).toHaveLength(2);
      expect(result.fields).toHaveLength(2);
    });

    it('should handle all result types', () => {
      const results: MetaCommandResult[] = [
        { type: 'success', message: 'OK' },
        { type: 'error', message: 'Failed' },
        { type: 'exit' }
      ];

      expect(results[0].type).toBe('success');
      expect(results[1].type).toBe('error');
      expect(results[2].type).toBe('exit');
    });
  });

  describe('ReplOptions', () => {
    it('should define ReplOptions interface correctly', () => {
      const options: ReplOptions = {
        prompt: 'supabase> ',
        multiline: true,
        history: true
      };

      expect(options.prompt).toBe('supabase> ');
      expect(options.multiline).toBe(true);
      expect(options.history).toBe(true);
    });

    it('should handle different prompt styles', () => {
      const options: ReplOptions[] = [
        { prompt: 'postgres=# ', multiline: false, history: true },
        { prompt: '> ', multiline: true, history: false },
        { prompt: 'sql>> ', multiline: true, history: true }
      ];

      options.forEach(option => {
        expect(typeof option.prompt).toBe('string');
        expect(typeof option.multiline).toBe('boolean');
        expect(typeof option.history).toBe('boolean');
      });
    });
  });

  describe('MetaCommand', () => {
    it('should define valid meta commands', () => {
      const commands: MetaCommand[] = [
        'quit',
        'help',
        'list_tables',
        'describe_table',
        'list_databases',
        'list_schemas',
        'list_users'
      ];

      commands.forEach(command => {
        expect(typeof command).toBe('string');
      });
    });

    it('should allow assignment of valid commands', () => {
      const quitCommand: MetaCommand = 'quit';
      const helpCommand: MetaCommand = 'help';
      const listTablesCommand: MetaCommand = 'list_tables';

      expect(quitCommand).toBe('quit');
      expect(helpCommand).toBe('help');
      expect(listTablesCommand).toBe('list_tables');
    });

    // TypeScript should prevent invalid assignments (compile-time check)
    it('should represent all expected meta commands', () => {
      const expectedCommands = [
        'quit',
        'help', 
        'list_tables',
        'describe_table',
        'list_databases',
        'list_schemas',
        'list_users'
      ];

      expectedCommands.forEach(command => {
        const metaCommand: MetaCommand = command as MetaCommand;
        expect(expectedCommands).toContain(metaCommand);
      });
    });
  });

  describe('FileExecutionSummary', () => {
    it('should define FileExecutionSummary interface correctly', () => {
      const summary: FileExecutionSummary = {
        totalStatements: 10,
        successfulStatements: 8,
        failedStatements: 2,
        totalExecutionTime: 1234.56,
        filePath: '/path/to/script.sql'
      };

      expect(summary.totalStatements).toBe(10);
      expect(summary.successfulStatements).toBe(8);
      expect(summary.failedStatements).toBe(2);
      expect(summary.totalExecutionTime).toBe(1234.56);
      expect(summary.filePath).toBe('/path/to/script.sql');
    });

    it('should handle edge cases', () => {
      const edgeCases: FileExecutionSummary[] = [
        {
          totalStatements: 0,
          successfulStatements: 0,
          failedStatements: 0,
          totalExecutionTime: 0,
          filePath: ''
        },
        {
          totalStatements: 1000,
          successfulStatements: 1000,
          failedStatements: 0,
          totalExecutionTime: 999999.99,
          filePath: '/very/long/path/to/some/deeply/nested/sql/file.sql'
        }
      ];

      edgeCases.forEach(summary => {
        expect(typeof summary.totalStatements).toBe('number');
        expect(typeof summary.successfulStatements).toBe('number');
        expect(typeof summary.failedStatements).toBe('number');
        expect(typeof summary.totalExecutionTime).toBe('number');
        expect(typeof summary.filePath).toBe('string');
      });
    });

    it('should maintain execution statistics consistency', () => {
      const summary: FileExecutionSummary = {
        totalStatements: 15,
        successfulStatements: 12,
        failedStatements: 3,
        totalExecutionTime: 567.89,
        filePath: '/test/migration.sql'
      };

      // Total should equal successful + failed
      expect(summary.totalStatements).toBe(
        summary.successfulStatements + summary.failedStatements
      );
    });
  });

  describe('AdminProject', () => {
    it('should define AdminProject interface correctly', () => {
      const project: AdminProject = {
        id: 'proj-123',
        name: 'My Project',
        createdAt: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-15T10:30:00Z',
        isActive: true
      };

      expect(project.id).toBe('proj-123');
      expect(project.name).toBe('My Project');
      expect(project.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(project.lastAccessed).toBe('2024-01-15T10:30:00Z');
      expect(project.isActive).toBe(true);
    });

    it('should handle inactive projects', () => {
      const inactiveProject: AdminProject = {
        id: 'proj-inactive',
        name: 'Archived Project',
        createdAt: '2023-01-01T00:00:00Z',
        lastAccessed: '2023-06-01T00:00:00Z',
        isActive: false
      };

      expect(inactiveProject.isActive).toBe(false);
    });

    it('should handle multiple projects', () => {
      const projects: AdminProject[] = [
        {
          id: 'proj-1',
          name: 'Production',
          createdAt: '2024-01-01T00:00:00Z',
          lastAccessed: '2024-01-15T00:00:00Z',
          isActive: true
        },
        {
          id: 'proj-2',
          name: 'Staging',
          createdAt: '2024-01-02T00:00:00Z',
          lastAccessed: '2024-01-14T00:00:00Z',
          isActive: true
        },
        {
          id: 'proj-3',
          name: 'Development',
          createdAt: '2024-01-03T00:00:00Z',
          lastAccessed: '2024-01-13T00:00:00Z',
          isActive: false
        }
      ];

      expect(projects).toHaveLength(3);
      expect(projects.filter(p => p.isActive)).toHaveLength(2);
      expect(projects.filter(p => !p.isActive)).toHaveLength(1);
    });
  });

  describe('AdminError', () => {
    it('should define AdminError interface correctly', () => {
      const error: AdminError = {
        error: 'project_not_found',
        message: 'The specified project was not found'
      };

      expect(error.error).toBe('project_not_found');
      expect(error.message).toBe('The specified project was not found');
      expect(error.details).toBeUndefined();
    });

    it('should allow optional details', () => {
      const detailedError: AdminError = {
        error: 'validation_failed',
        message: 'Project validation failed',
        details: 'Project name must be between 3 and 50 characters'
      };

      expect(detailedError.details).toBeDefined();
      expect(detailedError.details).toBe('Project name must be between 3 and 50 characters');
    });

    it('should handle various admin error types', () => {
      const errors: AdminError[] = [
        {
          error: 'unauthorized',
          message: 'Access denied'
        },
        {
          error: 'project_limit_exceeded',
          message: 'Cannot create more projects',
          details: 'Maximum of 10 projects allowed per account'
        },
        {
          error: 'invalid_configuration',
          message: 'Project configuration is invalid'
        }
      ];

      errors.forEach(error => {
        expect(error.error).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.error).toBe('string');
        expect(typeof error.message).toBe('string');
      });
    });
  });

  describe('AdminResponse', () => {
    it('should define successful AdminResponse', () => {
      const response: AdminResponse<AdminProject[]> = {
        data: [
          {
            id: 'proj-1',
            name: 'Test Project',
            createdAt: '2024-01-01T00:00:00Z',
            lastAccessed: '2024-01-15T00:00:00Z',
            isActive: true
          }
        ]
      };

      expect(response.data).toBeDefined();
      expect(response.data).toHaveLength(1);
      expect(response.error).toBeUndefined();
    });

    it('should define error AdminResponse', () => {
      const response: AdminResponse = {
        error: {
          error: 'internal_error',
          message: 'An internal error occurred'
        }
      };

      expect(response.error).toBeDefined();
      expect(response.data).toBeUndefined();
      expect(response.error.error).toBe('internal_error');
    });

    it('should define AdminResponse with message', () => {
      const response: AdminResponse = {
        message: 'Project created successfully'
      };

      expect(response.message).toBe('Project created successfully');
      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
    });

    it('should handle different data types', () => {
      const stringResponse: AdminResponse<string> = {
        data: 'success'
      };

      const numberResponse: AdminResponse<number> = {
        data: 42
      };

      const objectResponse: AdminResponse<{ count: number }> = {
        data: { count: 5 }
      };

      expect(stringResponse.data).toBe('success');
      expect(numberResponse.data).toBe(42);
      expect(objectResponse.data?.count).toBe(5);
    });

    it('should handle combined response data', () => {
      const response: AdminResponse<AdminProject[]> = {
        data: [
          {
            id: 'proj-1',
            name: 'Project 1',
            createdAt: '2024-01-01T00:00:00Z',
            lastAccessed: '2024-01-15T00:00:00Z',
            isActive: true
          }
        ],
        message: 'Projects retrieved successfully'
      };

      expect(response.data).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.error).toBeUndefined();
    });
  });

  describe('Type Consistency and Validation', () => {
    it('should maintain type safety across interfaces', () => {
      // This test ensures that related types work well together
      const queryResult: QueryResult = {
        data: [{ id: 1, name: 'test' }],
        rowCount: 1,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'text' }
        ],
        executionTime: 15.7
      };

      const metaResult: MetaCommandResult = {
        type: 'success',
        data: queryResult.data,
        fields: queryResult.fields,
        message: 'Query executed successfully'
      };

      expect(metaResult.data).toEqual(queryResult.data);
      expect(metaResult.fields).toEqual(queryResult.fields);
    });

    it('should handle complex nested data structures', () => {
      // Test that our types can handle realistic complex data
      const complexProject: AdminProject = {
        id: 'proj-complex-123',
        name: 'Complex Project with Special Characters & Numbers 123',
        createdAt: '2024-01-01T12:34:56.789Z',
        lastAccessed: '2024-01-15T09:22:11.456Z',
        isActive: true
      };

      const complexResponse: AdminResponse<AdminProject> = {
        data: complexProject,
        message: 'Project retrieved with complex data'
      };

      expect(complexResponse.data?.name).toContain('Special Characters');
      expect(complexResponse.data?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should maintain consistency between query results and errors', () => {
      // Success case
      const successResult: QueryResult = {
        data: [{ count: 5 }],
        rowCount: 1,
        fields: [{ name: 'count', type: 'bigint' }]
      };

      // Error case
      const errorResult: QueryError = {
        error: 'relation_not_found',
        message: 'relation "non_existent_table" does not exist',
        hint: 'Check that the table name is correct'
      };

      // Both should be valid for their respective use cases
      expect(successResult.data).toBeDefined();
      expect(errorResult.error).toBeDefined();
    });
  });
});