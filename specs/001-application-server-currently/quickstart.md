# Quickstart: Application Server

**Feature**: Application Server with WebVM  
**Date**: 2025-09-17  
**Purpose**: Validate implementation with end-to-end user scenario

## Overview
This quickstart validates the complete Application Server feature by walking through the primary user journey: deploying and running a web application using the WebVM-based hosting system.

## Prerequisites
- Modern browser with WebAssembly support (Chrome 91+, Firefox 89+, Safari 15+)
- Supabase Lite application running locally
- Sample web application files for deployment

## User Journey Validation

### 1. Feature Access and Initialization
**Action**: Navigate to Application Server from main navigation
**Expected Behavior**:
- ✅ Application Server page loads without affecting main app performance
- ✅ WebVM component lazy-loads only when accessed
- ✅ Initial loading indicator shows WebVM initialization progress
- ✅ Runtime environments list displays available options

**Validation Steps**:
```javascript
// Browser console validation
console.log('WebVM lazy loading:', window.webVMLoaded === undefined);
// Navigate to Application Server
console.log('WebVM loaded:', window.webVMLoaded === true);
```

### 2. Application Deployment
**Action**: Deploy a simple static web application
**Expected Behavior**:
- ✅ "Deploy New App" button opens deployment wizard
- ✅ File upload accepts folder structure (HTML, CSS, JS files)
- ✅ Runtime selection shows "Static Web Server" option
- ✅ App ID validation prevents duplicate IDs
- ✅ Deployment progress indicator shows upload and processing status

**Test Application**: Simple HTML page with Supabase API integration
```html
<!DOCTYPE html>
<html>
<head>
    <title>Test App</title>
</head>
<body>
    <h1>Hello from Application Server!</h1>
    <div id="data"></div>
    <script>
        // Test Supabase API access
        fetch('/rest/v1/health')
            .then(r => r.json())
            .then(data => {
                document.getElementById('data').innerHTML = 
                    'Supabase API: ' + JSON.stringify(data);
            });
    </script>
</body>
</html>
```

**Validation Criteria**:
- App deploys successfully to WebVM
- Files are persisted in IndexedDB
- Application appears in applications list with "running" status

### 3. Application Access and Routing
**Action**: Access deployed application via /app/{app-id} URL
**Expected Behavior**:
- ✅ MSW routes request to WebVM application
- ✅ Static files serve correctly with proper MIME types
- ✅ JavaScript executes and can access Supabase APIs
- ✅ Page loads within 2 seconds after WebVM initialization

**Browser Test**:
```javascript
// Navigate to /app/test-app
window.location.href = '/app/test-app';
// Verify page loads and API access works
```

### 4. Application Management
**Action**: Manage application lifecycle from UI
**Expected Behavior**:
- ✅ Application list shows correct status, runtime, metadata
- ✅ Stop button transitions app from "running" to "stopped" 
- ✅ Start button transitions app from "stopped" to "running"
- ✅ Edit functionality updates application name and description
- ✅ Delete removes application and offers runtime cleanup

### 5. Runtime Environment Management
**Action**: Install additional runtime environment
**Expected Behavior**:
- ✅ Node.js runtime installs on-demand when selected
- ✅ Installation progress shows in UI
- ✅ Runtime persists across browser sessions
- ✅ Multiple applications can use same runtime

### 6. State Persistence
**Action**: Refresh browser and verify persistence
**Expected Behavior**:
- ✅ WebVM state restores from IndexedDB snapshot
- ✅ Applications maintain status and configuration
- ✅ Runtime environments remain installed
- ✅ Running applications automatically restart

## Performance Validation

### Initialization Benchmarks
- WebVM first load: < 10 seconds
- WebVM restore from snapshot: < 3 seconds  
- Application deployment: < 30 seconds
- Application start time: < 5 seconds

### Resource Usage
- Memory overhead: < 200MB for WebVM instance
- Storage usage: < 100MB for base runtime environments
- Network requests: Only for runtime downloads

## Error Scenarios

### 1. WebVM Initialization Failure
**Trigger**: Browser without WebAssembly support
**Expected**: Clear error message with browser compatibility info

### 2. Application Deployment Failure
**Trigger**: Upload corrupted or oversized files
**Expected**: Validation error with specific failure reason

### 3. Runtime Installation Failure
**Trigger**: Network interruption during runtime download
**Expected**: Retry mechanism with progress recovery

### 4. State Corruption Recovery
**Trigger**: Corrupted IndexedDB state
**Expected**: Graceful fallback to clean WebVM initialization

## Integration Testing

### MSW API Integration
**Test**: Verify deployed apps can access all Supabase APIs
```javascript
// From deployed application
const tests = [
    fetch('/rest/v1/health'),
    fetch('/auth/v1/health'),
    fetch('/storage/v1/health'),
    fetch('/functions/v1/health')
];

Promise.all(tests).then(responses => {
    console.log('API access:', responses.map(r => r.status));
    // All should return 200
});
```

### VFS Integration  
**Test**: Verify application files persist correctly
```javascript
// Check VFS storage
const vfs = VFSManager.getInstance();
vfs.listFiles('/apps/test-app/').then(files => {
    console.log('Persisted files:', files.length > 0);
});
```

## Success Criteria
- [ ] All user journey steps complete successfully
- [ ] Performance benchmarks met
- [ ] Error scenarios handled gracefully  
- [ ] State persistence works across sessions
- [ ] API integration maintains full compatibility
- [ ] No regressions in existing Supabase Lite functionality

## Rollback Plan
If validation fails:
1. Disable Application Server feature flag
2. Restore previous "App Hosting" components
3. Clear WebVM-related IndexedDB data
4. Remove WebVM dependencies from build

## Post-Launch Monitoring
- WebVM initialization success rate
- Application deployment success rate
- Average application start time
- Memory usage patterns
- User adoption metrics