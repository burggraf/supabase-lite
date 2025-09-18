# Feature Specification: Application Server

**Feature Branch**: `001-application-server-currently`  
**Created**: 2025-09-17  
**Status**: Draft  
**Input**: User description: "Application Server
Currently we have a feature called "App Hosting".  We need to remove that feature entirely and replace it with a much more robust version that uses a virtual WebVM server that serves up one or more application hosting environments such as:
* Static web server 
* Node.js 
* Next.js
* Python 
* Etc. 
If possible (research this thoroughly) I would like to offer the ability to host Supabase Edge Functions using the Supabase Edge Function Runtime.  If this requires Docker, forget it, but if it's possible to host the runtime directly inside the WebVM we definitely want this and it should be a priority runtime. 

The WebVM server should be lazy loaded on demand only - we don't want this feature to impact the performance or UX of running the main app.

The user should have the ability to deploy one or more applications to the Application Server, and once deployed, those apps should be stored persistently across page refreshes or future restarts. 

When deploying an app the user should be able to choose a runtime environment for their app.  We should maintain an inventory of available runtimes potentially with different versions available so the user can choose a very specific environment.  Initially we'll keep this list small, supporting the latest Next.js, the latest stable Node.js, Python, and static web hosting. The specific runtime environment will be installed into the WebVM on demand when the user chooses it (if that environment has not already been installed).  Environments will be loaded remotely in order to keep the payload of our main application as small as possible. Once installed, an environment will be persistent in the WebVM and will survive page refreshes and restarts. 

The UI should show the list of applications the user has installed.  This list should contain:
* App ID (used for routing the app from the main site, such as my-app would be hosted at https://supabase-lite.com/app/my-app
* App name 
* App description 
* Runtime type and version (I.e Next.js version 19.1x)
* Status (stopped, starting, running, etc.)

The Deploy App button should allow the user to create a new app and deploy it.  Initially the user can upload their app from a folder in their disk (or possibly load an app from a remote url - maybe even from a GitHub repository).  Ideally the user would be able to specify a local folder on their system to be watched and the app would be hot reloaded when files in this folder changed (though this feature is not required for this initial implementation.)

Routing:
The existing MSW (Mock Service Worker) API system needs to route web requests from the /app domain to the app running inside the WebVM. So once deployed, if the user's app-id is "my-app" then requests from the /app/my-app domain would be routed to the my-app application running inside the WebVM.  We will need to be able to handle all the features of a modern app including passing parameters, posting data, cookies, tokens, authentication redirects, etc.  Think through what the challenges might be for users who are developing complex apps in this environment and try to accommodate as much functionality as possible.  

It's important that the user applications running at /app/my-app can access all the other MSW APIs such as /rest/v1, /auth, /health, etc. 

If it's possible, we should maintain the state of the WebVM and restore state as quickly and efficiently as possible when the user returns to our application (think page refreshes or restarts).  We want the best user (developer) experience possible. 

Users should be able to start and stop an application, change the name or other details of an application, and delete an application at any time.  If a user deletes an application and the runtime that application used is no longer in use by any other applications the user should have the option to remove that runtime from the WebVM or to keep it installed. 

Only one application needs to running at one time; but if there are no issues or performance concerns with keeping multiple applications running at the same time we can allow it.  However if you feel this is too difficult or would impact performance significantly then just limit the system to only allow one running application at a time."

## Execution Flow (main)
```
1. Parse user description from Input
   ’ If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   ’ Identify: actors, actions, data, constraints
3. For each unclear aspect:
   ’ Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   ’ If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   ’ Each requirement must be testable
   ’ Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   ’ If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   ’ If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ¡ Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a developer using Supabase Lite, I want to deploy and host my web applications directly within the platform so that I can develop, test, and demonstrate full-stack applications that integrate with Supabase services without requiring external hosting providers.

### Acceptance Scenarios
1. **Given** I am on the Application Server page, **When** I click "Deploy New App", **Then** I should see a deployment wizard that allows me to upload my application files and select a runtime environment
2. **Given** I have deployed an application with app-id "my-blog", **When** I navigate to /app/my-blog, **Then** my application should load and function correctly with full access to Supabase APIs
3. **Given** I have multiple applications deployed, **When** I view the applications list, **Then** I should see each app's ID, name, description, runtime version, and current status
4. **Given** I want to stop a running application, **When** I click the stop button for that app, **Then** the application should stop and its status should update to "stopped"
5. **Given** I delete an application whose runtime is not used by other apps, **When** the deletion completes, **Then** I should be offered the option to remove the unused runtime environment

### Edge Cases
- What happens when multiple applications try to use the same app-id?
- How does the system handle corrupted or invalid application files during upload?
- What occurs when a runtime environment fails to install or becomes corrupted?
- How does the system behave when the WebVM runs out of memory or storage space?
- What happens if the user closes the browser while an application is deploying?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST completely replace the existing "App Hosting" feature with the new Application Server
- **FR-002**: System MUST support deployment of multiple applications with unique app identifiers
- **FR-003**: System MUST provide runtime environment selection including Static Web Server, Node.js, Next.js, Python, and Supabase Edge Functions runtime
- **FR-004**: System MUST lazy-load the WebVM only when Application Server features are accessed
- **FR-005**: System MUST persist deployed applications across browser sessions and page refreshes
- **FR-006**: System MUST route requests from /app/{app-id} pattern to the corresponding deployed application
- **FR-007**: System MUST allow applications to access existing Supabase APIs (/rest/v1, /auth, /health, etc.)
- **FR-008**: System MUST support application lifecycle management (start, stop, restart, delete)
- **FR-009**: System MUST display application list with app ID, name, description, runtime version, and status
- **FR-010**: System MUST allow users to upload applications from local folders
- **FR-011**: System MUST install runtime environments on-demand and persist them across sessions
- **FR-012**: System MUST load runtime environments remotely to minimize main application payload
- **FR-013**: System MUST preserve WebVM state and restore it efficiently on application restart
- **FR-014**: System MUST handle modern web application features including URL parameters, POST data, cookies, and authentication flows
- **FR-015**: System MUST allow editing of application metadata (name, description)
- **FR-016**: System MUST provide option to remove unused runtime environments when last dependent application is deleted
- **FR-017**: System MUST support [NEEDS CLARIFICATION: concurrent applications - should multiple apps run simultaneously or limit to one?]
- **FR-018**: System MUST validate uploaded applications for [NEEDS CLARIFICATION: what constitutes a valid application structure?]
- **FR-019**: System MUST handle [NEEDS CLARIFICATION: maximum application size limits not specified]
- **FR-020**: System MUST provide [NEEDS CLARIFICATION: specific error handling and user feedback mechanisms not detailed]

### Key Entities *(include if feature involves data)*
- **Application**: Represents a deployed web application with unique identifier, metadata (name, description), runtime environment, deployment files, and current status
- **Runtime Environment**: Represents an available execution environment (Static, Node.js, Next.js, Python, Edge Functions) with version information and installation status
- **WebVM Instance**: Represents the virtual machine state containing installed runtimes and running applications
- **Application Deployment**: Represents the deployment process and artifacts for a specific application version
- **Routing Rule**: Represents the mapping between app-id patterns and running application instances

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---