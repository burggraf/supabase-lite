# API Docs PRD - Product Requirements Document

## Overview
This document outlines the requirements for implementing an API Documentation section that exactly replicates the Supabase dashboard API docs structure and content from `https://supabase.com/dashboard/project/njknhalxnjqqeqoegymr/api`.

## Captured Structure

### Main Navigation Sidebar
The API docs should have a sidebar with the following sections:

```
GETTING STARTED
├── Introduction
├── Authentication
└── User Management

TABLES AND VIEWS
├── Introduction
├── orders
└── products

STORED PROCEDURES
├── Introduction
├── get_category_summary
├── get_product_stats
└── get_products_by_category

GRAPHQL
└── GraphiQL

MORE RESOURCES
├── Guides
└── API Reference
```

### Main Content Area
- JavaScript/Bash toggle buttons for code examples
- Project connection information
- Dynamic content based on selected sidebar item

## Captured Content

### Introduction Section
```markdown
# Connect to your project

All projects have a RESTful endpoint that you can use with your project's API key to query and manage your database. These can be obtained from the API settings.

You can initialize a new Supabase client using the createClient() method. The Supabase client is your entrypoint to the rest of the Supabase functionality and is the easiest way to interact with everything we offer within the Supabase ecosystem.

## Initializing
```javascript
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://njknhalxnjqqeqoegymr.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
```

### Authentication Section
```markdown
# Authentication

Supabase works through a mixture of JWT and Key auth.

If no Authorization header is included, the API will assume that you are making a request with an anonymous user.

If an Authorization header is included, the API will "switch" to the role of the user making the request. See the User Management section for more details.

We recommend setting your keys as Environment Variables.

## Client API Keys

Client keys allow "anonymous access" to your database, until the user has logged in. After logging in the keys will switch to the user's own login token.

In this documentation, we will refer to the key using the name SUPABASE_KEY.

We have provided you a Client Key to get started. You will soon be able to add as many keys as you like. You can find the anon key in the API Settings page.

### CLIENT API KEY
```javascript
const SUPABASE_KEY = 'SUPABASE_CLIENT_API_KEY'
```

### EXAMPLE USAGE
```javascript
const SUPABASE_URL = "https://njknhalxnjqqeqoegymr.supabase.co"
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_KEY);
```

## Service Keys

Service keys have FULL access to your data, bypassing any security policies. Be VERY careful where you expose these keys. They should only be used on a server and never on a client or browser.

In this documentation, we will refer to the key using the name SERVICE_KEY.

We have provided you with a Service Key to get started. Soon you will be able to add as many keys as you like. You can find the service_role in the API Settings page.

### SERVICE KEY
```javascript
const SERVICE_KEY = 'SUPABASE_SERVICE_KEY'
```

### EXAMPLE USAGE
```javascript
const SUPABASE_URL = "https://njknhalxnjqqeqoegymr.supabase.co"
const supabase = createClient(SUPABASE_URL, process.env.SERVICE_KEY);
```

### Table Documentation Structure (Example: orders table)

Each table section includes:

1. **Column Documentation**:
   - Column name, type, format, and description
   - Individual SELECT examples for each column

2. **CRUD Operations**:
   - **Read rows**: select method with examples
   - **Filtering**: comprehensive filter examples
   - **Insert rows**: single and bulk inserts, upsert
   - **Update rows**: update with filters
   - **Delete rows**: delete with filters

3. **Realtime Subscriptions**:
   - Subscribe to all events
   - Subscribe to specific operations (INSERT, UPDATE, DELETE)
   - Subscribe to specific rows with filters

### Example Column Structure
```
COLUMN: id
- Required
- TYPE: number
- FORMAT: integer
- SELECT example:
  let { data: orders, error } = await supabase
    .from('orders')
    .select('id')
```

### Example CRUD Operations
```javascript
// READ ALL ROWS
let { data: orders, error } = await supabase
  .from('orders')
  .select('*')

// WITH FILTERING
let { data: orders, error } = await supabase
  .from('orders')
  .select("*")
  .eq('column', 'Equal to')
  .gt('column', 'Greater than')
  // ... more filters

// INSERT A ROW
const { data, error } = await supabase
  .from('orders')
  .insert([
    { some_column: 'someValue', other_column: 'otherValue' },
  ])
  .select()

// UPDATE MATCHING ROWS
const { data, error } = await supabase
  .from('orders')
  .update({ other_column: 'otherValue' })
  .eq('some_column', 'someValue')
  .select()

// DELETE MATCHING ROWS
const { error } = await supabase
  .from('orders')
  .delete()
  .eq('some_column', 'someValue')
```

## Implementation Requirements

### File Structure
```
src/pages/APIDocs.tsx                 # Main API docs page
src/components/api-docs/
├── APISidebar.tsx                    # Navigation sidebar
├── APIContent.tsx                    # Main content area
├── CodeToggle.tsx                    # JavaScript/Bash toggle
├── sections/
│   ├── Introduction.tsx              # Getting started intro
│   ├── Authentication.tsx            # Auth documentation
│   ├── UserManagement.tsx           # User mgmt docs
│   ├── TablesIntro.tsx              # Tables overview
│   ├── TableDocs.tsx                # Dynamic table docs
│   ├── StoredProcedures.tsx         # SP documentation
│   └── GraphQL.tsx                  # GraphQL docs
└── types/
    └── api-docs.types.ts            # TypeScript interfaces
```

### Navigation Integration
- Update `src/lib/constants.ts` to enable "API Docs" in main navigation
- Ensure proper routing in `App.tsx`

### Dynamic Content Generation
- Table documentation should be generated from actual database schema
- Use existing DatabaseManager to query table structures
- Generate column documentation, types, and examples dynamically

### Styling Requirements
- Match Supabase's design system using existing shadcn/ui components
- Maintain responsive design
- Use consistent typography and spacing
- Implement proper syntax highlighting for code blocks

### Key Features to Implement
1. **Sidebar Navigation**: Collapsible sections with active state
2. **Code Examples**: JavaScript/Bash toggle functionality
3. **Dynamic URLs**: Update based on our local project URL
4. **Copy-to-Clipboard**: For all code examples
5. **Search Functionality**: Filter through documentation sections
6. **Responsive Design**: Mobile-friendly layout

## Technical Specifications

### Component Hierarchy
```
APIDocs
├── APISidebar
│   ├── Navigation sections
│   └── Active state management
└── APIContent
    ├── CodeToggle (JS/Bash)
    ├── Dynamic content rendering
    └── Code syntax highlighting
```

### State Management
- Use React hooks for navigation state
- Implement URL-based routing for deep linking
- Maintain active section highlighting

### Integration Points
- Connect to existing DatabaseManager for live schema data
- Use existing project configuration for URLs and keys
- Integrate with current authentication system for key display

## Success Criteria
1. ✅ Exact visual replica of Supabase API docs
2. ✅ Complete sidebar navigation structure
3. ✅ All captured content sections implemented
4. ✅ Dynamic table documentation based on actual schema
5. ✅ Working code examples with proper syntax highlighting
6. ✅ Responsive design matching our app's design system
7. ✅ Integration with existing navigation system

## Implementation Priority
1. **Phase 1**: Basic page structure and sidebar navigation
2. **Phase 2**: Static content sections (Introduction, Authentication)
3. **Phase 3**: Dynamic table documentation generation
4. **Phase 4**: Code examples and syntax highlighting
5. **Phase 5**: Advanced features (search, copy-to-clipboard)

This PRD provides the complete roadmap for implementing an exact replica of the Supabase API documentation within our Supabase Lite application.