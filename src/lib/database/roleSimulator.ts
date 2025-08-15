export interface DatabaseRole {
  id: string;
  name: string;
  description: string;
  isSuperuser: boolean;
  permissions: string[];
  defaultSchemas: string[];
  queryPrefix?: string;
  queryRestrictions?: {
    allowedCommands?: string[];
    blockedCommands?: string[];
    allowedSchemas?: string[];
    blockedSchemas?: string[];
  };
}

export interface RoleSimulationContext {
  currentRole: DatabaseRole;
  sessionVariables: Record<string, any>;
}

export class RoleSimulator {
  private static instance: RoleSimulator;
  private currentRole: DatabaseRole;
  private sessionVariables: Record<string, any> = {};

  private constructor() {
    this.currentRole = AVAILABLE_ROLES.postgres; // Default to postgres
  }

  public static getInstance(): RoleSimulator {
    if (!RoleSimulator.instance) {
      RoleSimulator.instance = new RoleSimulator();
    }
    return RoleSimulator.instance;
  }

  public setRole(role: DatabaseRole): void {
    this.currentRole = role;
    this.sessionVariables = {
      'auth.role': role.id,
      'auth.uid': role.id === 'anon' ? null : 'simulated-user-id',
      'request.jwt.claims': role.id === 'anon' ? {} : { role: role.id, sub: 'simulated-user-id' }
    };
  }

  public getCurrentRole(): DatabaseRole {
    return this.currentRole;
  }

  public getSessionVariables(): Record<string, any> {
    return { ...this.sessionVariables };
  }

  public preprocessQuery(sql: string): string {
    const trimmedSql = sql.trim();
    
    // For single queries, just validate permissions but don't modify the SQL
    // We'll handle role context through session management instead
    this.validateQueryPermissions(trimmedSql);
    
    // Return the original query unchanged - role context is handled elsewhere
    return trimmedSql;
  }

  private validateQueryPermissions(sql: string): void {
    const command = sql.trim().split(/\s+/)[0]?.toUpperCase();
    const restrictions = this.currentRole.queryRestrictions;

    if (!restrictions) return; // No restrictions for this role

    // Check allowed commands
    if (restrictions.allowedCommands && !restrictions.allowedCommands.includes(command)) {
      throw new Error(`Command ${command} is not allowed for role ${this.currentRole.name}`);
    }

    // Check blocked commands
    if (restrictions.blockedCommands && restrictions.blockedCommands.includes(command)) {
      throw new Error(`Command ${command} is blocked for role ${this.currentRole.name}`);
    }

    // Check schema restrictions for table operations
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(command)) {
      this.validateSchemaAccess(sql);
    }
  }

  private validateSchemaAccess(sql: string): void {
    const restrictions = this.currentRole.queryRestrictions;
    if (!restrictions) return;

    // Simple schema validation - look for schema.table patterns
    const sqlLower = sql.toLowerCase();
    const schemas = ['auth', 'storage', 'realtime'];
    
    for (const schema of schemas) {
      if (sqlLower.includes(`${schema}.`)) {
        if (restrictions.allowedSchemas && !restrictions.allowedSchemas.includes(schema)) {
          throw new Error(`Access to schema ${schema} is not allowed for role ${this.currentRole.name}`);
        }
        
        if (restrictions.blockedSchemas && restrictions.blockedSchemas.includes(schema)) {
          throw new Error(`Access to schema ${schema} is blocked for role ${this.currentRole.name}`);
        }
      }
    }
  }

  private buildQueryPrefix(): string {
    const prefixParts: string[] = [];

    // Add role-specific query prefix
    if (this.currentRole.queryPrefix) {
      prefixParts.push(this.currentRole.queryPrefix);
    }

    // Set search path for non-superuser roles
    if (!this.currentRole.isSuperuser && this.currentRole.defaultSchemas.length > 0) {
      const searchPath = this.currentRole.defaultSchemas.join(', ');
      prefixParts.push(`SET search_path TO ${searchPath}`);
    }

    // Set session variables
    Object.entries(this.sessionVariables).forEach(([key, value]) => {
      const sqlValue = value === null ? 'NULL' : 
                      typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` :
                      typeof value === 'object' ? `'${JSON.stringify(value).replace(/'/g, "''")}'` :
                      String(value);
      prefixParts.push(`SET ${key} = ${sqlValue}`);
    });

    return prefixParts.length > 0 ? prefixParts.join(';\n') + ';\n' : '';
  }
}

// Predefined roles that simulate Supabase roles
export const AVAILABLE_ROLES: Record<string, DatabaseRole> = {
  postgres: {
    id: 'postgres',
    name: 'postgres',
    description: 'Database superuser with full access',
    isSuperuser: true,
    permissions: ['all'],
    defaultSchemas: ['public', 'auth', 'storage', 'realtime'],
  },
  supabase_admin: {
    id: 'supabase_admin',
    name: 'supabase_admin',
    description: 'Supabase admin role with administrative privileges',
    isSuperuser: false,
    permissions: ['create', 'read', 'update', 'delete', 'admin'],
    defaultSchemas: ['public', 'auth', 'storage'],
    queryPrefix: `SET role = 'supabase_admin'`,
    queryRestrictions: {
      blockedCommands: ['DROP DATABASE', 'CREATE DATABASE'],
      allowedSchemas: ['public', 'auth', 'storage', 'realtime']
    }
  },
  authenticated: {
    id: 'authenticated',
    name: 'authenticated',
    description: 'Authenticated user role',
    isSuperuser: false,
    permissions: ['read', 'update', 'insert'],
    defaultSchemas: ['public'],
    queryPrefix: `SET role = 'authenticated'`,
    queryRestrictions: {
      allowedCommands: ['SELECT', 'INSERT', 'UPDATE', 'WITH'],
      allowedSchemas: ['public']
    }
  },
  anon: {
    id: 'anon',
    name: 'anon',
    description: 'Anonymous user role',
    isSuperuser: false,
    permissions: ['read'],
    defaultSchemas: ['public'],
    queryPrefix: `SET role = 'anon'`,
    queryRestrictions: {
      allowedCommands: ['SELECT', 'WITH'],
      allowedSchemas: ['public']
    }
  },
  service_role: {
    id: 'service_role',
    name: 'service_role',
    description: 'Service role for backend operations',
    isSuperuser: false,
    permissions: ['create', 'read', 'update', 'delete'],
    defaultSchemas: ['public', 'auth', 'storage'],
    queryPrefix: `SET role = 'service_role'`,
    queryRestrictions: {
      allowedSchemas: ['public', 'auth', 'storage', 'realtime']
    }
  }
};

// Export singleton instance
export const roleSimulator = RoleSimulator.getInstance();