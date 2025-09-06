// Utility functions for test cleanup

/**
 * Extracts table names from CREATE TABLE statements in SQL
 * Handles both quoted and unquoted table names
 */
function extractTableNamesFromSQL(sql) {
  if (!sql || typeof sql !== 'string') return [];
  
  const tableNames = [];
  
  // Regular expression to match CREATE TABLE statements
  // Handles both quoted and unquoted table names
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"([^"]+)"|([^\s(]+))/gi;
  
  let match;
  while ((match = createTableRegex.exec(sql)) !== null) {
    // match[1] is quoted table name, match[2] is unquoted table name
    const tableName = match[1] || match[2];
    if (tableName && !tableNames.includes(tableName)) {
      tableNames.push(tableName);
    }
  }
  
  return tableNames;
}

/**
 * Cleans up tables by dropping them with CASCADE
 * Drops in reverse order to handle dependencies
 */
async function executeCleanupSQL(tables, debugSqlEndpoint) {
  if (!tables || tables.length === 0) return;
  
  console.log(`🧹 Cleaning up ${tables.length} test tables...`);
  
  // Drop in reverse order to handle dependencies
  const tablesToDrop = [...tables].reverse();
  
  for (const table of tablesToDrop) {
    try {
      // Handle both quoted and unquoted table names
      const quotedTable = table.includes(' ') || table.includes('-') ? `"${table}"` : table;
      
      const response = await fetch(debugSqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `DROP TABLE IF EXISTS ${quotedTable} CASCADE` })
      });
      
      // Don't throw on cleanup errors, just log them
      const result = await response.json();
      if (result.error) {
        console.log(`⚠️  Cleanup warning for ${table}: ${result.error}`);
      }
    } catch (err) {
      console.log(`⚠️  Cleanup error for ${table}: ${err.message}`);
    }
  }
  
  console.log('✅ Cleanup completed');
}

export { extractTableNamesFromSQL, executeCleanupSQL };