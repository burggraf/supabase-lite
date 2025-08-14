# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Vite on port 5173)
- `npm run build` - Build for production (TypeScript check + Vite build)
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview production build locally

## Architecture Overview

### Core Database Layer
- **PGlite Integration**: WebAssembly PostgreSQL running in browser with IndexedDB persistence
- **DatabaseManager** (`src/lib/database/connection.ts`): Singleton class managing PGlite instance
  - Handles initialization, schema setup, query execution, and connection state
  - Auto-creates `auth`, `storage`, `realtime` schemas and sample `users`/`posts` tables
  - Provides database size calculation and table listing functionality
- **useDatabase Hook** (`src/hooks/useDatabase.ts`): React hook wrapping DatabaseManager
  - Manages connection state, error handling, and provides query execution interface
  - Includes useQueryHistory hook for localStorage-based query history (limit: 100 queries)

### Application Structure
- **Single Page Application**: React 19 + TypeScript + Vite
- **State Management**: React hooks (no external state library)
- **Routing**: Simple string-based page switching in App.tsx (no React Router)
- **UI Components**: shadcn/ui components with Tailwind CSS
- **Code Editor**: Monaco Editor for SQL editing with syntax highlighting

### Component Architecture
```
src/
├── components/
│   ├── ui/              # shadcn/ui components (button, card, badge)
│   ├── dashboard/       # Dashboard and Sidebar components
│   └── sql-editor/      # SQLEditor component
├── hooks/               # Custom React hooks for database operations
├── lib/
│   ├── database/        # DatabaseManager and PGlite connection
│   ├── constants.ts     # App config, navigation items, query examples
│   └── utils.ts         # Utility functions
└── types/               # TypeScript interfaces for DB operations
```

### Key Design Patterns
- **Singleton Database Manager**: Single PGlite instance shared across application
- **Hook-based State**: Database operations wrapped in React hooks
- **Component Composition**: UI built with reusable shadcn/ui components
- **Local Persistence**: IndexedDB for database, localStorage for query history
- **Error Boundary Pattern**: Try-catch with user-friendly error states

### Technology Stack Details
- **Frontend**: React 19, TypeScript 5.8, Vite 7
- **Database**: @electric-sql/pglite (WebAssembly PostgreSQL)
- **Editor**: Monaco Editor (VS Code editor in browser)
- **UI**: Tailwind CSS + shadcn/ui + Lucide React icons
- **Build**: Vite with TypeScript checking, ESLint for linting

### Future Architecture Notes
Navigation items in constants.ts show planned features (auth, storage, realtime, edge-functions, api) that will extend the current database-focused architecture. The DatabaseManager already creates schemas for these future services.