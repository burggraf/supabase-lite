<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Detailed Plan for Emulating PostgREST's API Engine in Typescript

**Main Takeaway:**
To emulate PostgREST in the browser with Typescript, focus on its core pipeline: parsing HTTP requests (JSON:API and RESTful conventions), mapping them robustly to SQL, executing queries (via pglite/WASM), and serializing results back to API-compliant JSON. The most critical aspects are request parsing, query translation (including filter, sort, range, etc.), security enforcement, and results formatting. All can be modeled with Typescript and strong attention to PostgREST’s open source internals.

***

## Overview of PostgREST’s Internal Workflow

PostgREST is a Haskell server that exposes a RESTful API atop a PostgreSQL database. Its key job is converting HTTP(S) requests into SQL queries, executing them, then formatting responses. Its workflow includes:

- Parsing HTTP verbs, URL paths, and query parameters
- Translating these to SELECT/INSERT/UPDATE/DELETE SQL statements
- Mapping results and errors to JSON:API-like responses
- Applying RLS (Row Level Security), permissions, and pagination


### 1. HTTP Request Parsing

**Key Inputs:**

- Path (e.g., `/users`, `/posts?id=eq.10`)
- Method (GET/POST/PATCH/DELETE)
- Headers (Accept, Prefer, Content-Profile, etc.)
- Query parameters (filtering, sorting, pagination)

**How PostgREST Handles:**

- Uses route parser matching table/view/function names from path segments
- Destructures query parameters for filters (`?column=eq.value`), range (`Range:` header), and ordering (`order=column.desc`)
- Validates headers for content negotiation

**Typescript Counterpart:**

- Use a router (like express-like or MSW)
- Strongly type incoming requests. Parse URL, querystring with Typescript logic
- Convert filter, sort, and range params into an AST or command structure for later SQL rendering


### 2. Query Generation / Translation

**Key Algorithms:**

- Converts parsed inputs to SQL AST (Abstract Syntax Tree), recursively resolving filters, joins, limits, order, etc.
- Handles deep embeds via table/view relationships
- Applies parameterization to prevent injection

**How PostgREST Does It:**

- Uses Haskell’s parser combinators to construct SQL queries
- Joins, aggregates, and subqueries for embedded resources (`/users?select=*,posts(*)`)
- Uses PostgreSQL’s JSON and computed columns for flexible result shaping

**Typescript Counterpart:**

- Model query AST with Typescript interfaces
- Use builder patterns or functional composition to turn AST into SQL strings
- Modularize SQL rendering (SELECT, WHERE, JOIN, ORDER BY, LIMIT/OFFSET)
- Ensure all values are parameterized (param binding for pglite)


### 3. Security and Policies

**Key Concepts:**

- Leverages PostgreSQL’s RLS for data access control
- Auth context is passed as request headers or JWT and set via session in database

**Typescript Implications:**

- For browser use, RLS emulation might be optional/minimal (since code is client-side – warn about risk)
- Support projecting authenticated user info into queries as PostgREST does with `jwt.claims` or similar


### 4. Result Serialization/Formatting

**Key Features:**

- Converts SQL results back into JSON according to Accept/Prefer headers
- Handles singular/plural response shapes (`/users?select=*` vs `/users?id=eq.5`)
- Implements pagination via headers and response shape

**Typescript Counterpart:**

- Serialize results directly from pglite query output to API format
- Implement pagination, enum conversions, and error handling consistent with PostgREST

***

## Actionable Steps and Tips for Typescript Implementation

### 1. **Request Routing \& Decoding**

- Use an MSW or Express-style router mirroring PostgREST route logic.
- Define Typescript types for filters, order, pagination, embedding.

```typescript
type FilterOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'like' | 'ilike' | 'in';
interface Filter { column: string; op: FilterOp; value: string; }
interface QueryOpts {
  select: string[];
  filters: Filter[];
  order?: { column: string; dir: 'asc' | 'desc' };
  range?: { offset: number; limit: number };
}
```

- Parse `/table?col=eq.value&order=col.desc&limit=10` into `QueryOpts`.


### 2. **SQL AST \& String Construction**

- Model a SQL SELECT as a tree of objects/classes.
- Build SQL strings using template string or a builder that escapes user input.
- Support deep embeddeds by recursively building JOINs and subqueries.

```typescript
function buildSelect(opts: QueryOpts): string {
  // Compose SELECT, FROM, WHERE, ORDER BY, LIMIT clauses
  // For embedding: recursively join related tables and select nested as JSON
}
```

- Consider popular SQL query builder libraries, but adapt for pglite and Supabase conventions.


### 3. **Executing Queries in WASM (pglite)**

- Use the pglite API to execute SQL and receive results as JS objects.
- Bind all values (avoid string interpolation).


### 4. **Serializing Results**

- Shape API response as PostgREST would: status codes, headers, and JSON structure.
- Implement error propagation: invalid filters, syntax, missing resources.
- Support formats: regular JSON, object/array shape, pagination headers.


### 5. **Authentication \& Policy Handling**

- Warn that client-side PostgREST in browser cannot ensure server-side security or privacy.
- For developer use, emulate RLS by stubbing/checking filters based on a simulated user context.

***

## Learning from PostgREST Source \& Docs

- Study the open source [PostgREST repo](https://github.com/PostgREST/postgrest), focusing on:
    - `App.hs` (main app loop)
    - `Request/Parser.hs` (parses HTTP to query command structure)
    - `QueryBuilder.hs` (core SQL generation)
    - `DbRequestBuilder.hs` (performs AST-to-SQL translation for CRUD)
    - `ApiRequest.hs` (formal API request representation)
    - `OpenAPI.hs` (API discovery logic)
- Pay special attention to the request parsing and query building modules for translation patterns

**Tips for Reverse Engineering:**

- Map each Haskell data structure and major function to a Typescript equivalent (interfaces, functions, classes, etc.)
- Read PostgREST’s request examples for real-world parameter mapping.
- Use Supabase API docs as templates for edge-case behavior and patterns.

***

## Additional Resources

- [PostgREST official documentation](https://postgrest.org/en/stable/)
- [Supabase REST API docs](https://supabase.com/docs/reference/api)
- [Source code: PostgREST](https://github.com/PostgREST/postgrest)
- Example open-source TypeScript query builders: [kysely](https://github.com/kysely-org/kysely), [zapatos](https://github.com/jawj/zapatos)
- MSW API mocking docs: [Mock Service Worker](https://mswjs.io/docs/)

***

### Summary

**Emulating PostgREST with Typescript:**

- Parse HTTP requests using conventions from PostgREST (route, query, headers).
- Convert parsed intent into a SQL AST with careful parameterization and embedding support.
- Use a query builder to generate and execute SQL in pglite/WASM.
- Shape and serialize the result as a PostgREST-compliant API response.
- Understand that security policies are not enforceable fully in-browser: warn users, and emulate only as far as possible.

This approach leverages PostgREST’s parsing and query generation patterns, adapting them to Typescript and browser-based execution for maximal API fidelity and developer ease-of-use.

