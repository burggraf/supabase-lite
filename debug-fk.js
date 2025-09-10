// Debug script to test foreign key relationships
async function testForeignKeys() {
  console.log('🧪 Testing foreign key relationships...')
  
  try {
    // 1. Create test data
    console.log('📝 Creating test tables...')
    await fetch('http://localhost:5173/debug/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "CREATE TABLE orchestral_sections (id int8 primary key, name text)" })
    }).then(r => r.json()).then(console.log)

    await fetch('http://localhost:5173/debug/sql', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "CREATE TABLE instruments (id int8 primary key, section_id int8 not null references orchestral_sections, name text)" })
    }).then(r => r.json()).then(console.log)

    // 2. Insert test data
    console.log('📝 Inserting test data...')
    await fetch('http://localhost:5173/debug/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "INSERT INTO orchestral_sections (id, name) VALUES (1, 'strings'), (2, 'woodwinds')" })
    }).then(r => r.json()).then(console.log)

    await fetch('http://localhost:5173/debug/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "INSERT INTO instruments (id, section_id, name) VALUES (1, 2, 'flute'), (2, 1, 'violin')" })
    }).then(r => r.json()).then(console.log)

    // 3. Test foreign key discovery
    console.log('🔍 Testing foreign key query...')
    const fkQuery = `
      SELECT 
        tc.table_name AS referencing_table,
        kcu.column_name AS foreign_key_column,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name 
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ((tc.table_name = 'orchestral_sections' AND ccu.table_name = 'instruments')
          OR (tc.table_name = 'instruments' AND ccu.table_name = 'orchestral_sections'))
    `
    
    const fkResult = await fetch('http://localhost:5173/debug/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: fkQuery })
    }).then(r => r.json())
    
    console.log('🔍 Foreign key discovery result:', fkResult)

    // 4. Test the embedded query
    console.log('🔍 Testing embedded resource query...')
    const response = await fetch('http://localhost:5173/rest/v1/orchestral_sections?select=name,instruments(name)')
    const result = await response.json()
    console.log('📊 Query result:', JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testForeignKeys()