# WebVM Static Host Integration Summary & Proxy Plan

## Summary to Date
- Added a new `Application Servers` page that lazily loads the WebVM runtime (CheerpX) and provides an xterm.js terminal for user interaction.
- Introduced `WebVMManager` (`src/lib/webvm/WebVMManager.ts`) to handle runtime loading, status tracking, and terminal bridging. The manager now:
  - Loads a local ext2 disk image from `public/webvm/v2/static-http.ext2` via `HttpBytesDevice`.
  - Boots BusyBox, launches `httpd` on port 8080 serving `/home/user/www`, and keeps an interactive `/bin/sh` prompt available.
  - Surfaces VM status transitions and error handling to the React UI.
- Created a minimal BusyBox-based ext2 image (~32 MB) via the WebVM GitHub Actions pipeline, designed specifically for static hosting.
- Updated the service worker:
  - Production builds still apply COOP/COEP headers to keep SharedArrayBuffer enabled.
  - Localhost/dev builds bypass the headers to avoid react-refresh runtime mismatches.
- Verified the new image boots successfully; terminal shows a prompt while static hosting runs in the background.

## MSW Proxy Plan (API Gateway for WebVM Static Apps)

### Current Status
- `WebVMManager.fetchStaticAsset` copies files from `/home/user/www` into a temporary path, reads them via the overlay IDB device, and returns the bytes with a MIME guess.
- New MSW handlers intercept `/api/app/:appName/*` (and `/api/app/:appName`) and proxy GET/HEAD requests through the WebVM bridge.
- Application Servers and MSW share the singleton `webvmManager` instance.
- Remaining work: response caching, richer error messaging, optional index listing, tests, and documentation tweaks.

### Goal
Expose static apps running inside WebVM at host routes like `/app/<app-name>/*`, routing browser requests through MSW to the in-VM HTTP server listening on port 8080.

### High-Level Architecture
1. **Request Interception**
   - Use MSW’s `http.all('/app/:appName/*', ...)` handler in `src/mocks/handlers/app.ts` (or a new module) to capture requests targeting `/app/<appName>/*`.
   - Optionally support `/api/app-name/*` if legacy routes exist, and redirect internally to `/app/<appName>/*` or vice versa.

2. **Bridge Layer**
   - `WebVMManager.fetchStaticAsset` now reads files directly from the VM file system by copying them to `/tmp` and streaming the overlay blob back to the host.
   - Optional future enhancements: stream without writing to disk, surface file metadata, or fall back to HTTP inside the VM for dynamic content.

3. **Response Handling**
   - Content-type is inferred by file extension. Consider enhancing with a richer MIME map or allowing the VM to store metadata alongside files.

4. **Error Handling & Status Codes**
   - Distinguish between VM not running (return 503, trigger user prompt) vs. missing file (404) vs. unexpected VM errors (500).
   - Log VM stderr to the terminal or console for debugging.

5. **Caching & Performance**
   - For static assets, optionally cache results in-memory on the host to reduce round trips (e.g., simple LRU keyed by path + appName).
   - Provide a cache-busting strategy (query param `?v=`) when the user redeploys assets inside the VM.

### Implementation Steps
1. **Bridge Utility**
   - Add `WebVMManager.fetch(path: string, init?: RequestInit)` that:
     - Ensures the VM is booted (`ensureStarted`).
     - Runs `busybox wget -qO-` (or similar) to fetch the file.
     - Returns `{ status, headers, body }` (status fallback 200, allow interceptors to adjust).
2. **MSW Handler**
   - In `src/mocks/handlers/app.ts` (or new module), add:
     ```ts
     http.all('/app/:appName/*', async ({ request, params }) => {
       const vmPath = request.url.pathname.replace(/^\/app\/[^/]+/, '');
       const vmResponse = await webvmBridge.fetch(vmPath || '/');
       return new Response(vmResponse.body, {
         status: vmResponse.status,
         headers: vmResponse.headers,
       });
     });
     ```
   - Handle method distinctions (GET only for now; respond 405 for others).
3. **Content-Type Support**
   - Map file extensions to MIME types (use a tiny lookup table).
   - If you can fetch headers from BusyBox httpd, parse them; otherwise, fallback to the lookup table.
4. **Boot Coordination**
   - If the VM isn’t ready, queue the request until `ensureStarted` resolves (show “Boot WebVM” toast in UI?).
   - Consider a feature flag to auto-start the VM when users hit `/app/...`.
5. **Tests**
   - Unit test the bridge (`WebVMManager.fetch`) by mocking the shell execution.
   - MSW handler integration test ensuring `/app/index.html` returns the expected HTML from the VM image.
6. **Docs/UX**
   - Update Application Servers page with instructions to drop assets into `/home/user/www`.
   - Provide a quick link to `/app/default/index.html` to preview the static site.

### Risks & Mitigations
- **Performance:** Shelling out per request is slow. Acceptable for static hosting MVP; monitor and optimize later (e.g., keep `wget` running via inetd, or implement a web socket bridge).
- **Binary Assets:** Ensure shell approach handles binary (use base64 or fetch piping). Using `busybox wget -O -` works because it outputs raw bytes; be careful to treat the result as `Uint8Array` instead of string.
- **Large Files:** Might hit memory limits piping entire file through Node. Add streaming support if necessary (CheerpX’s API may allow chunked reads; otherwise, enforce file size limits).

This document is self-contained so we can pick up later without context. Once ready, we’ll implement steps 1–5 and wire `/app/:appName/*` back to the static server running inside WebVM.
