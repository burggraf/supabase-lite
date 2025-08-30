/*
 * Multi-line block comment
 * This script tests comment handling
 */

-- Single line comment
SELECT 1 as test;

/* Inline block comment */ SELECT 'hello' as greeting;

-- Another comment
SELECT 
  /* inline comment in query */
  NOW() as current_time,
  'test' as status; -- end of line comment

/*
 * Final block comment
 * End of script
 */