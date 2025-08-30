-- This script contains intentional errors for testing

-- Valid statement first
SELECT 1 as valid_query;

-- Invalid syntax - missing FROM clause
SELECT * FROM nonexistent_table_12345;

-- Another valid statement after error
SELECT 'This should work' as message;