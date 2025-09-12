// Test the filtering fix directly
const embedded = [
  {
    table: "users",
    alias: "from",
    fkHint: "messages_sender_id_fkey",
    select: ["name"]
  },
  {
    table: "users",
    alias: "to", 
    fkHint: "messages_receiver_id_fkey",
    select: ["name"]
  }
];

console.log('Original embedded resources:', embedded);

// Apply the OLD filtering logic (the bug)
const oldFiltered = embedded.filter(embedded => {
  if (embedded.alias) {
    return true  // Always include if it has an alias
  }
  
  // Only include if there are no other embedded resources with aliases for the same table
  const hasAliasedVersion = embedded.some(other => 
    other.table === embedded.table && other.alias
  )
  return !hasAliasedVersion
});

console.log('OLD filtering result:', oldFiltered);

// Apply the NEW filtering logic (my fix)
const newFiltered = embedded.filter(embeddedResource => {
  if (embeddedResource.alias || embeddedResource.fkHint) {
    return true  // Always include if it has an alias or FK hint
  }
  
  // Only include if there are no other embedded resources with aliases or FK hints for the same table
  const hasAliasedOrHintedVersion = embedded.some(other => 
    other.table === embeddedResource.table && (other.alias || other.fkHint)
  )
  return !hasAliasedOrHintedVersion
});

console.log('NEW filtering result:', newFiltered);