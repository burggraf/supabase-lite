# Tasks: Application Server

**Input**: Design documents from `/specs/001-application-server-currently/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths assume React SPA structure with existing MSW/VFS integration

## Phase 3.1: Setup and Cleanup
- [ ] T001 Remove existing app-hosting feature components (src/components/app-hosting/*, src/pages/AppHosting.tsx)
- [ ] T002 Install WebVM dependencies and configure TypeScript types
- [ ] T003 [P] Configure linting rules for WebVM integration code
- [ ] T004 [P] Create TypeScript types for Application Server entities in src/types/application-server.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P]
- [ ] T005 [P] Contract test GET /api/applications in src/api/applications/__tests__/applications-get.test.ts
- [ ] T006 [P] Contract test POST /api/applications in src/api/applications/__tests__/applications-post.test.ts
- [ ] T007 [P] Contract test GET /api/applications/{appId} in src/api/applications/__tests__/applications-get-id.test.ts
- [ ] T008 [P] Contract test PUT /api/applications/{appId} in src/api/applications/__tests__/applications-put.test.ts
- [ ] T009 [P] Contract test DELETE /api/applications/{appId} in src/api/applications/__tests__/applications-delete.test.ts
- [ ] T010 [P] Contract test POST /api/applications/{appId}/start in src/api/applications/__tests__/applications-start.test.ts
- [ ] T011 [P] Contract test POST /api/applications/{appId}/stop in src/api/applications/__tests__/applications-stop.test.ts
- [ ] T012 [P] Contract test POST /api/applications/{appId}/deploy in src/api/applications/__tests__/applications-deploy.test.ts
- [ ] T013 [P] Contract test GET /api/runtimes in src/api/runtimes/__tests__/runtimes-get.test.ts
- [ ] T014 [P] Contract test GET /api/runtimes/{runtimeId} in src/api/runtimes/__tests__/runtimes-get-id.test.ts
- [ ] T015 [P] Contract test POST /api/runtimes/{runtimeId}/install in src/api/runtimes/__tests__/runtimes-install.test.ts
- [ ] T016 [P] Contract test POST /api/runtimes/{runtimeId}/uninstall in src/api/runtimes/__tests__/runtimes-uninstall.test.ts
- [ ] T017 [P] Contract test GET /api/webvm/status in src/api/webvm/__tests__/webvm-status.test.ts
- [ ] T018 [P] Contract test POST /api/webvm/initialize in src/api/webvm/__tests__/webvm-init.test.ts
- [ ] T019 [P] Contract test POST /api/webvm/snapshot in src/api/webvm/__tests__/webvm-snapshot.test.ts
- [ ] T020 [P] Contract test POST /api/webvm/restore in src/api/webvm/__tests__/webvm-restore.test.ts

### Integration Tests [P]
- [ ] T021 [P] Integration test WebVM lazy loading in src/components/application-server/__tests__/lazy-loading.test.tsx
- [ ] T022 [P] Integration test application deployment flow in src/components/application-server/__tests__/deployment-flow.test.tsx
- [ ] T023 [P] Integration test MSW routing to WebVM apps in src/api/__tests__/webvm-routing.test.ts
- [ ] T024 [P] Integration test state persistence across sessions in src/lib/application-server/__tests__/state-persistence.test.ts
- [ ] T025 [P] Integration test runtime environment installation in src/lib/application-server/__tests__/runtime-installation.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models [P]
- [ ] T026 [P] Application entity model in src/lib/application-server/models/Application.ts
- [ ] T027 [P] RuntimeEnvironment entity model in src/lib/application-server/models/RuntimeEnvironment.ts
- [ ] T028 [P] WebVMInstance entity model in src/lib/application-server/models/WebVMInstance.ts
- [ ] T029 [P] ApplicationDeployment entity model in src/lib/application-server/models/ApplicationDeployment.ts
- [ ] T030 [P] RoutingRule entity model in src/lib/application-server/models/RoutingRule.ts

### Core Services
- [ ] T031 ApplicationManager service in src/lib/application-server/ApplicationManager.ts
- [ ] T032 RuntimeManager service in src/lib/application-server/RuntimeManager.ts
- [ ] T033 WebVMBridge service for PostMessage communication in src/lib/application-server/WebVMBridge.ts
- [ ] T034 WebVMManager service for instance lifecycle in src/lib/application-server/WebVMManager.ts
- [ ] T035 DeploymentService for app deployment in src/lib/application-server/DeploymentService.ts

### Storage Layer
- [ ] T036 ApplicationStorage for IndexedDB persistence in src/lib/application-server/storage/ApplicationStorage.ts
- [ ] T037 RuntimeStorage for runtime environment data in src/lib/application-server/storage/RuntimeStorage.ts
- [ ] T038 WebVMStorage for state snapshots in src/lib/application-server/storage/WebVMStorage.ts

## Phase 3.4: API Implementation

### MSW Handlers
- [ ] T039 Applications API handlers in src/api/applications/handlers.ts
- [ ] T040 Runtimes API handlers in src/api/runtimes/handlers.ts
- [ ] T041 WebVM API handlers in src/api/webvm/handlers.ts
- [ ] T042 App routing handlers for /app/{app-id} pattern in src/api/app-routing/handlers.ts

### API Integration
- [ ] T043 Update MSW handlers index to include Application Server APIs in src/api/index.ts
- [ ] T044 Add WebVM proxy middleware for external API access in src/api/middleware/webvm-proxy.ts

## Phase 3.5: UI Components

### Core Components [P]
- [ ] T045 [P] ApplicationServer main page component in src/pages/ApplicationServer.tsx
- [ ] T046 [P] ApplicationList display component in src/components/application-server/ApplicationList.tsx
- [ ] T047 [P] ApplicationCard individual app component in src/components/application-server/ApplicationCard.tsx
- [ ] T048 [P] DeploymentWizard modal component in src/components/application-server/DeploymentWizard.tsx
- [ ] T049 [P] RuntimeSelector component in src/components/application-server/RuntimeSelector.tsx
- [ ] T050 [P] FileUploader for app deployment in src/components/application-server/FileUploader.tsx
- [ ] T051 [P] WebVMStatus indicator component in src/components/application-server/WebVMStatus.tsx

### React Hooks [P]
- [ ] T052 [P] useApplicationServer hook in src/hooks/useApplicationServer.ts
- [ ] T053 [P] useWebVM hook for VM management in src/hooks/useWebVM.ts
- [ ] T054 [P] useApplicationDeployment hook in src/hooks/useApplicationDeployment.ts

## Phase 3.6: Integration and Navigation
- [ ] T055 Update main navigation to replace "App Hosting" with "Application Server" in src/lib/constants.ts
- [ ] T056 Update App.tsx routing to handle ApplicationServer page in src/App.tsx
- [ ] T057 WebVM lazy loading implementation in ApplicationServer page component
- [ ] T058 Error boundary for WebVM failures in src/components/application-server/WebVMErrorBoundary.tsx

## Phase 3.7: Polish and Validation
- [ ] T059 [P] Unit tests for ApplicationManager in src/lib/application-server/__tests__/ApplicationManager.test.ts
- [ ] T060 [P] Unit tests for WebVMBridge in src/lib/application-server/__tests__/WebVMBridge.test.ts
- [ ] T061 [P] Unit tests for DeploymentService in src/lib/application-server/__tests__/DeploymentService.test.ts
- [ ] T062 Performance optimization for WebVM initialization (<2s target)
- [ ] T063 Memory usage optimization for WebVM instances
- [ ] T064 Run quickstart.md validation scenarios
- [ ] T065 Update CLAUDE.md with Application Server architecture notes
- [ ] T066 Clean up unused app-hosting imports and references

## Dependencies
- Setup (T001-T004) before everything
- Tests (T005-T025) before implementation (T026-T058)
- Models (T026-T030) before Services (T031-T038)
- Services before API handlers (T039-T044)
- Core implementation before UI (T045-T058)
- Integration (T055-T058) before Polish (T059-T066)

## Parallel Example
```
# Launch contract tests together (T005-T020):
Task: "Contract test GET /api/applications in src/api/applications/__tests__/applications-get.test.ts"
Task: "Contract test POST /api/applications in src/api/applications/__tests__/applications-post.test.ts"
Task: "Contract test GET /api/runtimes in src/api/runtimes/__tests__/runtimes-get.test.ts"
Task: "Contract test GET /api/webvm/status in src/api/webvm/__tests__/webvm-status.test.ts"
# ... (continue with all contract tests)

# Launch data models together (T026-T030):
Task: "Application entity model in src/lib/application-server/models/Application.ts"
Task: "RuntimeEnvironment entity model in src/lib/application-server/models/RuntimeEnvironment.ts"
Task: "WebVMInstance entity model in src/lib/application-server/models/WebVMInstance.ts"
# ... (continue with all models)

# Launch UI components together (T045-T051):
Task: "ApplicationList display component in src/components/application-server/ApplicationList.tsx"
Task: "ApplicationCard individual app component in src/components/application-server/ApplicationCard.tsx"
Task: "DeploymentWizard modal component in src/components/application-server/DeploymentWizard.tsx"
# ... (continue with all components)
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- WebVM integration requires careful PostMessage protocol implementation
- State persistence critical for user experience
- MSW routing must maintain compatibility with existing APIs
- Remove all app-hosting code completely to avoid conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - applications-api.yaml → 8 contract test tasks [P]
   - runtimes-api.yaml → 4 contract test tasks [P]
   - webvm-api.yaml → 4 contract test tasks [P]
   
2. **From Data Model**:
   - 5 entities → 5 model creation tasks [P]
   - Relationships → service layer tasks
   
3. **From User Stories**:
   - Quickstart scenarios → 5 integration tests [P]
   - WebVM integration → specialized validation tasks

4. **Ordering**:
   - Cleanup → Setup → Tests → Models → Services → APIs → UI → Integration → Polish
   - WebVM bridge must complete before API routing implementation

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (16 contract tests)
- [x] All entities have model tasks (5 models)
- [x] All tests come before implementation (T005-T025 before T026+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] WebVM integration complexity properly broken down
- [x] MSW routing integration included
- [x] State persistence requirements covered
- [x] Cleanup of existing app-hosting feature included