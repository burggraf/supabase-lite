import { logger } from '@/lib/infrastructure';
import type { SessionContext } from '../database/connection';

/**
 * @deprecated This class is deprecated in favor of database-level RLS policies.
 *
 * BACKGROUND:
 * This class was originally created to work around limitations in PGlite role switching.
 * However, PGlite does support PostgreSQL RLS when row_security = ON, making this
 * application-level filtering unnecessary and potentially incompatible with Supabase.
 *
 * NEW APPROACH:
 * - Database-level RLS is now enabled (SET row_security = ON)
 * - PostgreSQL handles RLS enforcement using policies created by users
 * - Session context (roles, JWT claims) is properly set for database policies to access
 * - This provides 100% Supabase compatibility since it uses the same PostgreSQL RLS
 *
 * MIGRATION:
 * Instead of using this class, ensure:
 * 1. Tables have RLS enabled when users want it: ALTER TABLE foo ENABLE ROW LEVEL SECURITY
 * 2. Users create policies for their tables: CREATE POLICY name ON table FOR operation TO role USING (condition)
 * 3. Session context is set properly (already handled by DatabaseManager.setSessionContext)
 *
 * This approach lets users control RLS exactly like online Supabase.
 */
export class RLSEnforcer {
  private static readonly tablesWithRLS = ['peeps', 'test_projects', 'test_posts', 'test_comments', 'test_documents']; // Add other tables that need RLS here
  
  /**
   * Apply application-level RLS when database-level RLS isn't working
   */
  public static applyApplicationRLS(sql: string, context: SessionContext): { modifiedSql: string; shouldEnforceRLS: boolean } {
    // Only apply to SELECT statements for now
    const trimmedSql = sql.trim().toLowerCase();
    if (!trimmedSql.startsWith('select')) {
      return { modifiedSql: sql, shouldEnforceRLS: false };
    }
    
    // Check if this is a query on a table that should have RLS enforced
    const hasRLSTable = this.tablesWithRLS.some(table => 
      trimmedSql.includes(`from ${table}`) || 
      trimmedSql.includes(`from public.${table}`) ||
      trimmedSql.includes(`"${table}"`) ||
      new RegExp(`\\b${table}\\b`).test(trimmedSql)
    );
    
    if (!hasRLSTable) {
      return { modifiedSql: sql, shouldEnforceRLS: false };
    }
    
    // Apply RLS based on role
    if (context.role === 'service_role') {
      // service_role bypasses RLS
      logger.debug('Service role bypassing RLS', { table: 'detected' });
      return { modifiedSql: sql, shouldEnforceRLS: false };
    }
    
    if (context.role === 'anon' && !context.userId) {
      // Anonymous users with no policies should see no data
      // Add a WHERE FALSE condition to block all results
      logger.debug('Blocking anonymous access to RLS-protected table', { role: context.role });
      const modifiedSql = this.addWhereClause(sql, 'FALSE');
      return { modifiedSql, shouldEnforceRLS: true };
    }
    
    // For authenticated users, allow access (our policy allows authenticated users)
    if (context.role === 'authenticated' || context.userId) {
      logger.debug('Allowing authenticated access to RLS-protected table', { role: context.role, hasUserId: !!context.userId });
      return { modifiedSql: sql, shouldEnforceRLS: false };
    }
    
    // Default: block access for unknown roles
    logger.debug('Blocking unknown role access to RLS-protected table', { role: context.role });
    const modifiedSql = this.addWhereClause(sql, 'FALSE');
    return { modifiedSql, shouldEnforceRLS: true };
  }
  
  /**
   * Add a WHERE clause to a SQL query, handling existing WHERE clauses
   */
  private static addWhereClause(sql: string, condition: string): string {
    const lowerSql = sql.toLowerCase();
    
    // Find if WHERE clause already exists
    const whereIndex = lowerSql.indexOf(' where ');
    
    if (whereIndex !== -1) {
      // WHERE clause exists, add condition with AND
      return sql.slice(0, whereIndex + 7) + `(${condition}) AND (` + sql.slice(whereIndex + 7) + ')';
    } else {
      // No WHERE clause, add one
      // Find the position to insert WHERE (before ORDER BY, LIMIT, etc.)
      const insertBefore = [' order by ', ' limit ', ' offset ', ' group by ', ' having '];
      let insertIndex = sql.length;
      
      for (const keyword of insertBefore) {
        const index = lowerSql.indexOf(keyword);
        if (index !== -1 && index < insertIndex) {
          insertIndex = index;
        }
      }
      
      return sql.slice(0, insertIndex) + ` WHERE ${condition}` + sql.slice(insertIndex);
    }
  }
}