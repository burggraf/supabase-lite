// Test the QueryParser to see what it generates
import { QueryParser } from './dist/lib/postgrest/QueryParser.js';

const testUrl = new URL('http://localhost/messages?select=content,from:users!messages_sender_id_fkey(name),to:users!messages_receiver_id_fkey(name)');
const query = QueryParser.parseQuery(testUrl, {});

console.log('🔍 Parsed Query:');
console.log(JSON.stringify(query, null, 2));

console.log('\n📋 Embedded Resources:');
if (query.embedded) {
  query.embedded.forEach((resource, index) => {
    console.log(`${index + 1}. Table: ${resource.table}, Alias: ${resource.alias}, FK Hint: ${resource.fkHint}`);
  });
} else {
  console.log('No embedded resources found');
}