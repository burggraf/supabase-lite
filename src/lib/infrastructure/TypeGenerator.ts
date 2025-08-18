import type { 
  TypeGenerator, 
  DatabaseSchema, 
  TableMetadata, 
  ColumnMetadata, 
  FunctionMetadata,
  ForeignKeyMetadata 
} from '@/types/infrastructure';
import { DatabaseManager } from '../database/connection';
import { logger } from './Logger';
import { errorHandler } from './ErrorHandler';

export class InfrastructureTypeGenerator implements TypeGenerator {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  generateTableTypes(tables: TableMetadata[]): string {
    const tableTypes = tables.map(table => this.generateTableType(table)).join('\n\n');
    
    return `// Auto-generated table types
// Generated at: ${new Date().toISOString()}

${tableTypes}

// Union type of all table names
export type TableName = ${tables.map(t => `'${t.name}'`).join(' | ')};

// Database type combining all tables
export interface Database {
${tables.map(t => `  ${t.name}: ${this.getTableTypeName(t.name)};`).join('\n')}
}

// Insert types (optional fields and auto-generated fields)
export type DatabaseInsert = {
${tables.map(t => `  ${t.name}: ${this.getTableTypeName(t.name)}Insert;`).join('\n')}
};

// Update types (all fields optional)
export type DatabaseUpdate = {
${tables.map(t => `  ${t.name}: ${this.getTableTypeName(t.name)}Update;`).join('\n')}
};`;
  }

  generateFunctionTypes(functions: FunctionMetadata[]): string {
    if (functions.length === 0) {
      return '// No functions found in the database';
    }

    const functionTypes = functions.map(func => this.generateFunctionType(func)).join('\n\n');
    
    return `// Auto-generated function types
// Generated at: ${new Date().toISOString()}

${functionTypes}

// Union type of all function names
export type FunctionName = ${functions.map(f => `'${f.name}'`).join(' | ')};`;
  }

  generateDatabaseTypes(schema: DatabaseSchema): string {
    const tableTypes = this.generateTableTypes(schema.tables);
    const functionTypes = this.generateFunctionTypes(schema.functions);
    const enumTypes = this.generateEnumTypes(schema);
    
    return `${enumTypes}

${tableTypes}

${functionTypes}

// Complete database schema type
export interface DatabaseSchema {
  tables: Database;
  functions: {
${schema.functions.map(f => `    ${f.name}: ${this.getFunctionTypeName(f.name)};`).join('\n')}
  };
}`;
  }

  async saveTypes(types: string, filePath: string): Promise<void> {
    try {
      // In a browser environment, we can't directly write to files
      // Instead, we'll create a downloadable blob
      const blob = new Blob([types], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop() || 'database-types.ts';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      logger.info('Types file generated and download initiated', { filePath });
    } catch (error) {
      logger.error('Failed to save types file', error as Error);
      throw errorHandler.handleError(error, { filePath });
    }
  }

  // Generate types for current database schema
  async generateCurrentDatabaseTypes(): Promise<string> {
    try {
      const schema = await this.getDatabaseSchema();
      return this.generateDatabaseTypes(schema);
    } catch (error) {
      logger.error('Failed to generate current database types', error as Error);
      throw errorHandler.handleError(error);
    }
  }

  // Save current database types to file
  async saveCurrentDatabaseTypes(filePath: string = 'src/types/database.ts'): Promise<void> {
    try {
      const types = await this.generateCurrentDatabaseTypes();
      await this.saveTypes(types, filePath);
      logger.info('Current database types saved', { filePath });
    } catch (error) {
      logger.error('Failed to save current database types', error as Error);
      throw error;
    }
  }

  private generateTableType(table: TableMetadata): string {
    const interfaceName = this.getTableTypeName(table.name);
    const insertTypeName = `${interfaceName}Insert`;
    const updateTypeName = `${interfaceName}Update`;
    
    // Main interface
    const mainInterface = `export interface ${interfaceName} {
${table.columns.map(col => `  ${col.name}: ${this.getTypeScriptType(col)};`).join('\n')}
}`;

    // Insert type (optional and auto-generated fields)
    const insertColumns = table.columns.filter(col => {
      // Make auto-generated fields optional
      return !col.defaultValue?.includes('gen_random_uuid()') && 
             !col.defaultValue?.includes('CURRENT_TIMESTAMP') &&
             col.name !== 'id';
    });
    
    const insertInterface = `export interface ${insertTypeName} {
${table.columns.map(col => {
  const optional = col.nullable || 
                   col.defaultValue || 
                   col.name === 'id' || 
                   col.name.includes('_at');
  return `  ${col.name}${optional ? '?' : ''}: ${this.getTypeScriptType(col)};`;
}).join('\n')}
}`;

    // Update type (all fields optional)
    const updateInterface = `export interface ${updateTypeName} {
${table.columns.map(col => `  ${col.name}?: ${this.getTypeScriptType(col)};`).join('\n')}
}`;

    return `${mainInterface}\n\n${insertInterface}\n\n${updateInterface}`;
  }

  private generateFunctionType(func: FunctionMetadata): string {
    const typeName = this.getFunctionTypeName(func.name);
    const returnType = this.mapPostgreSQLTypeToTypeScript(func.returnType);
    
    const parameters = func.parameters.length > 0 
      ? func.parameters.map(param => 
          `${param.name}: ${this.mapPostgreSQLTypeToTypeScript(param.type)}`
        ).join(', ')
      : '';

    return `export interface ${typeName} {
  Args: {${parameters ? `\n    ${parameters}\n  ` : ''}};
  Returns: ${returnType};
}`;
  }

  private generateEnumTypes(schema: DatabaseSchema): string {
    // Extract enum-like constraints from tables
    const enums: string[] = [];
    
    schema.tables.forEach(table => {
      table.columns.forEach(col => {
        // Look for CHECK constraints that define enums
        // This is a simplified implementation
        if (col.type.includes('CHECK')) {
          const enumName = `${this.pascalCase(table.name)}${this.pascalCase(col.name)}`;
          // Extract enum values from CHECK constraint
          // This would need more sophisticated parsing in a real implementation
          enums.push(`export type ${enumName} = 'value1' | 'value2';`);
        }
      });
    });
    
    return enums.length > 0 
      ? `// Enum types\n${enums.join('\n')}\n`
      : '';
  }

  private async getDatabaseSchema(): Promise<DatabaseSchema> {
    try {
      // Get all tables
      const tablesResult = await this.dbManager.query(`
        SELECT 
          schemaname,
          tablename,
          tableowner
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename
      `);

      const tables: TableMetadata[] = [];
      
      for (const tableRow of tablesResult.rows) {
        const columns = await this.getTableColumns(tableRow.tablename, tableRow.schemaname);
        const foreignKeys = await this.getTableForeignKeys(tableRow.tablename, tableRow.schemaname);
        const indexes = await this.getTableIndexes(tableRow.tablename, tableRow.schemaname);
        const primaryKeys = columns.filter(col => col.isPrimaryKey).map(col => col.name);

        tables.push({
          name: tableRow.tablename,
          schema: tableRow.schemaname,
          columns,
          primaryKeys,
          foreignKeys,
          indexes,
        });
      }

      // Get functions
      const functionsResult = await this.dbManager.query(`
        SELECT 
          n.nspname as schema,
          p.proname as name,
          pg_catalog.pg_get_function_result(p.oid) as return_type,
          p.prolang as language
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND p.prokind = 'f'
        ORDER BY n.nspname, p.proname
      `);

      const functions: FunctionMetadata[] = functionsResult.rows.map(row => ({
        name: row.name,
        schema: row.schema,
        returnType: row.return_type,
        parameters: [], // Would need additional query to get parameters
        language: row.language === 14 ? 'sql' : 'plpgsql', // Simplified
      }));

      return {
        tables,
        views: [], // Would need additional implementation
        functions,
        schemas: [...new Set(tables.map(t => t.schema))],
      };
    } catch (error) {
      logger.error('Failed to get database schema', error as Error);
      throw errorHandler.handleError(error);
    }
  }

  private async getTableColumns(tableName: string, schemaName: string): Promise<ColumnMetadata[]> {
    const result = await this.dbManager.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
          AND tc.table_schema = $2
      ) pk ON c.column_name = pk.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = $2
      ) fk ON c.column_name = fk.column_name
      WHERE c.table_name = $1 
        AND c.table_schema = $2
      ORDER BY c.ordinal_position
    `, [tableName, schemaName]);

    return result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      maxLength: row.character_maximum_length,
      precision: row.numeric_precision,
      scale: row.numeric_scale,
    }));
  }

  private async getTableForeignKeys(tableName: string, schemaName: string): Promise<ForeignKeyMetadata[]> {
    const result = await this.dbManager.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = $1
        AND tc.table_schema = $2
    `, [tableName, schemaName]);

    return result.rows.map(row => ({
      name: row.constraint_name,
      column: row.column_name,
      referencedTable: row.foreign_table_name,
      referencedColumn: row.foreign_column_name,
      onDelete: row.delete_rule as any,
      onUpdate: row.update_rule as any,
    }));
  }

  private async getTableIndexes(tableName: string, schemaName: string): Promise<any[]> {
    // Simplified index retrieval
    return [];
  }

  private getTableTypeName(tableName: string): string {
    return this.pascalCase(tableName);
  }

  private getFunctionTypeName(functionName: string): string {
    return `${this.pascalCase(functionName)}Function`;
  }

  private getTypeScriptType(column: ColumnMetadata): string {
    const baseType = this.mapPostgreSQLTypeToTypeScript(column.type);
    return column.nullable ? `${baseType} | null` : baseType;
  }

  private mapPostgreSQLTypeToTypeScript(pgType: string): string {
    const type = pgType.toLowerCase();
    
    // Handle array types
    if (type.includes('[]')) {
      const baseType = this.mapPostgreSQLTypeToTypeScript(type.replace('[]', ''));
      return `${baseType}[]`;
    }
    
    // Map PostgreSQL types to TypeScript types
    switch (type) {
      case 'boolean':
      case 'bool':
        return 'boolean';
        
      case 'smallint':
      case 'integer':
      case 'int':
      case 'int4':
      case 'bigint':
      case 'int8':
      case 'decimal':
      case 'numeric':
      case 'real':
      case 'float4':
      case 'double precision':
      case 'float8':
      case 'money':
        return 'number';
        
      case 'character varying':
      case 'varchar':
      case 'character':
      case 'char':
      case 'text':
      case 'citext':
        return 'string';
        
      case 'uuid':
        return 'string';
        
      case 'date':
      case 'timestamp':
      case 'timestamp without time zone':
      case 'timestamp with time zone':
      case 'timestamptz':
      case 'time':
      case 'time without time zone':
      case 'time with time zone':
      case 'timetz':
        return 'string'; // ISO date strings
        
      case 'json':
      case 'jsonb':
        return 'any'; // Could be more specific with generics
        
      case 'bytea':
        return 'Uint8Array';
        
      case 'inet':
      case 'cidr':
      case 'macaddr':
        return 'string';
        
      default:
        // Handle custom types and enums
        return 'any';
    }
  }

  private pascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

// Factory function
export const createTypeGenerator = (dbManager: DatabaseManager): TypeGenerator => {
  return new InfrastructureTypeGenerator(dbManager);
};

// Default type generator instance
export const typeGenerator = createTypeGenerator(DatabaseManager.getInstance());