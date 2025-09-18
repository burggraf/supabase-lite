
# Implementation Plan: Application Server

**Branch**: `001-application-server-currently` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-application-server-currently/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Replace existing "App Hosting" feature with robust Application Server using WebVM to support multiple runtime environments (Static, Node.js, Next.js, Python, Supabase Edge Functions). The system will lazy-load WebVM on demand, provide persistent application deployment with MSW routing integration at /app/{app-id} patterns, and support complete application lifecycle management.

## Technical Context
**Language/Version**: TypeScript 5.8, React 19.1.1, WebAssembly (for WebVM)  
**Primary Dependencies**: WebVM (CheerpX), MSW, Vite, IndexedDB, VFS (existing)  
**Storage**: IndexedDB (via existing VFS), WebVM internal filesystem  
**Testing**: Vitest, React Testing Library, MSW for API mocking  
**Target Platform**: Modern browsers (Chrome/Firefox/Safari), WebAssembly support required
**Project Type**: web - frontend single-page application with extensive MSW API layer  
**Performance Goals**: Lazy WebVM loading, minimal main app payload impact, <2s WebVM initialization  
**Constraints**: Browser-only operation (no Node.js), WebVM networking limitations, Supabase Edge Functions runtime may require Docker (research needed)  
**Scale/Scope**: Multiple concurrent apps, persistent state across sessions, full HTTP routing compatibility

**Existing Architecture Integration**:
- MSW API handlers at /app/{app-id} must route to WebVM applications  
- VFS system (IndexedDB) for persistent application storage
- Existing auth/database/storage APIs must remain accessible to hosted apps
- Current app-hosting components to be completely replaced

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Assessment**: Constitution file contains placeholder template - no specific principles defined yet. Proceeding with standard web application practices:
- ✅ Browser-only operation (maintains existing architecture)
- ✅ Test-driven development (TDD mandatory per CLAUDE.md)
- ✅ Integration with existing MSW/VFS systems
- ✅ Component-based React architecture
- ⚠️ WebVM integration complexity requires careful modularization

**Post-Design Assessment**: Design remains compliant with established patterns:
- ✅ API contracts follow existing MSW handler patterns
- ✅ Data model integrates with existing IndexedDB/VFS storage
- ✅ Component architecture maintains React/TypeScript standards
- ✅ WebVM bridge service provides clean separation of concerns
- ✅ No violations of browser-only architecture constraint

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 1 (Single project) - Integrating into existing React SPA with current src/ structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Remove existing app-hosting components first (cleanup phase)
- Generate contract tests for Applications, Runtimes, WebVM APIs
- Create data model entities and persistence layers
- Implement WebVM integration and bridge services
- Build React components for Application Server UI
- Add MSW routing handlers for /app/{app-id} pattern

**Ordering Strategy**:
1. **Cleanup Phase**: Remove existing app-hosting code
2. **Foundation Phase**: Data models, types, persistence (TDD)
3. **WebVM Phase**: WebVM integration, bridge service, state management
4. **API Phase**: MSW handlers, contract tests, API services  
5. **UI Phase**: React components, deployment wizard, application management
6. **Integration Phase**: End-to-end testing, quickstart validation

**Key Dependencies**:
- WebVM integration must complete before MSW routing
- Data models required before API implementation
- Contract tests must exist before implementation
- UI components depend on API services

**Parallel Execution Opportunities**:
- [P] Contract test files (independent)
- [P] Data model entities (after types defined)
- [P] React component files (after shared hooks)
- [P] MSW handler files (after bridge service)

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none identified)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
