// Debug script to reproduce the failing PostgREST test
async function testQuery() {
  console.log('🔍 Testing failing query...')
  
  // First, set up the test data
  console.log('📝 Setting up test data...')
  const setupResponse = await fetch('http://localhost:5174/debug/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sql: `
        DROP TABLE IF EXISTS instruments CASCADE;
        DROP TABLE IF EXISTS orchestral_sections CASCADE;
        
        CREATE TABLE orchestral_sections (id int8 primary key, name text);
        CREATE TABLE instruments (
          id int8 primary key,
          section_id int8 not null references orchestral_sections,
          name text
        );
        
        INSERT INTO orchestral_sections (id, name) VALUES
          (1, 'strings'),
          (2, 'woodwinds');
        INSERT INTO instruments (id, section_id, name) VALUES
          (1, 2, 'flute'),
          (2, 1, 'violin');
      ` 
    }),
  })
  
  if (!setupResponse.ok) {
    console.error('❌ Setup failed:', await setupResponse.text())
    return
  }
  
  console.log('✅ Test data setup complete')
  
  // Now test the failing query
  console.log('🧪 Testing query: instruments.select("name, orchestral_sections(*)").eq("orchestral_sections.name", "percussion")')
  
  const testResponse = await fetch('http://localhost:5174/rest/v1/instruments?select=name,orchestral_sections(*)&orchestral_sections.name=eq.percussion', {
    method: 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'apikey': 'test-key'
    },
  })
  
  const result = await testResponse.json()
  console.log('📊 Result:', JSON.stringify(result, null, 2))
  
  // Expected: orchestral_sections should be null, not []
  const expectedOrchestraSections = null
  const actualOrchestraSections = result.data?.[0]?.orchestral_sections
  
  console.log('🎯 Expected orchestral_sections:', expectedOrchestraSections)
  console.log('📋 Actual orchestral_sections:', actualOrchestraSections) 
  
  if (JSON.stringify(actualOrchestraSections) === JSON.stringify(expectedOrchestraSections)) {
    console.log('✅ Test PASSED!')
  } else {
    console.log('❌ Test FAILED!')
    console.log('   Expected: null')
    console.log('   Actual:  ', JSON.stringify(actualOrchestraSections))
  }
}

testQuery().catch(console.error)