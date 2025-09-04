# WebVM Deployment Guide

This guide explains how to deploy Supabase Lite with WebVM support to various hosting platforms. WebVM requires specific security headers to function properly due to its use of SharedArrayBuffer.

## Overview

WebVM provides browser-native Linux environment execution using WebAssembly. It requires `SharedArrayBuffer` support, which browsers only enable when specific Cross-Origin Resource Sharing (CORS) headers are present.

### Required Headers

For SharedArrayBuffer to be available, the following headers must be set:

```
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

## Platform-Specific Configuration

### Cloudflare Pages

**✅ CONFIGURED** - Headers are already configured in `public/_headers`:

```
# Global headers for SharedArrayBuffer support (required for WebVM)
/*
  Cross-Origin-Embedder-Policy: credentialless
  Cross-Origin-Opener-Policy: same-origin
```

**Deployment:**
1. Deploy to Cloudflare Pages normally
2. Headers are automatically applied from `public/_headers` file
3. WebVM should work immediately after deployment

### Vercel

Create `vercel.json` in project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        },
        {
          "key": "Cross-Origin-Opener-Policy", 
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

### Netlify

Create `netlify.toml` in project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "credentialless"
    Cross-Origin-Opener-Policy = "same-origin"
```

### GitHub Pages

GitHub Pages doesn't support custom headers. WebVM **will not work** on GitHub Pages due to this limitation.

**Alternative for GitHub Pages:**
1. Use GitHub Actions to deploy to another platform
2. Consider using GitHub Codespaces for development instead

### Firebase Hosting

Create `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Cross-Origin-Embedder-Policy",
            "value": "credentialless"
          },
          {
            "key": "Cross-Origin-Opener-Policy",
            "value": "same-origin"
          }
        ]
      }
    ]
  }
}
```

### AWS S3 + CloudFront

1. **S3**: Static files don't support custom headers
2. **CloudFront**: Configure custom headers in CloudFront distribution:

```yaml
# CloudFormation example
ResponseHeadersPolicy:
  Type: AWS::CloudFront::ResponseHeadersPolicy
  Properties:
    ResponseHeadersPolicyConfig:
      CustomHeaders:
        Items:
          - Header: Cross-Origin-Embedder-Policy
            Value: credentialless
            Override: false
          - Header: Cross-Origin-Opener-Policy
            Value: same-origin
            Override: false
```

### Apache (.htaccess)

Add to `.htaccess` file:

```apache
Header always set Cross-Origin-Embedder-Policy "credentialless"
Header always set Cross-Origin-Opener-Policy "same-origin"
```

### Nginx

Add to nginx configuration:

```nginx
add_header Cross-Origin-Embedder-Policy credentialless;
add_header Cross-Origin-Opener-Policy same-origin;
```

## Development vs Production

### Development (Vite Dev Server)

Headers are automatically configured in `vite.config.ts`:

```typescript
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin'
  }
}
```

### Production Build

Ensure your hosting platform applies the headers to the built files in the `dist/` directory.

## Troubleshooting

### SharedArrayBuffer Not Available

If you see the warning: "SharedArrayBuffer is not available", check:

1. **HTTPS**: SharedArrayBuffer requires HTTPS (except localhost)
2. **Headers**: Verify the COOP/COEP headers are being sent
3. **Browser**: Use Chrome 92+, Firefox 95+, or Safari 15.2+
4. **Network**: Corporate firewalls may block WebAssembly

### Checking Headers

Use browser developer tools:

1. Open DevTools → Network tab
2. Reload the page
3. Check the main document response headers
4. Verify both `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` are present

### Browser Console

Check for SharedArrayBuffer availability:

```javascript
console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');
```

### Testing Locally

1. Run `npm run dev` (headers configured automatically)
2. Visit `http://localhost:5173/webvm`
3. SharedArrayBuffer should be available

## Security Considerations

### Why These Headers?

- **Cross-Origin-Embedder-Policy**: Prevents loading of cross-origin resources without explicit permission
- **Cross-Origin-Opener-Policy**: Prevents access to window references across origins
- These headers enable "Cross-Origin Isolation" required for SharedArrayBuffer

### Impact on Other Features

The `credentialless` policy is less restrictive than `require-corp` but still provides security while allowing more embedded content to work.

## Platform Compatibility

| Platform | Support | Configuration |
|----------|---------|---------------|
| Cloudflare Pages | ✅ | `public/_headers` |
| Vercel | ✅ | `vercel.json` |
| Netlify | ✅ | `netlify.toml` |
| Firebase Hosting | ✅ | `firebase.json` |
| AWS CloudFront | ✅ | Distribution config |
| GitHub Pages | ❌ | No header support |
| Apache | ✅ | `.htaccess` |
| Nginx | ✅ | Server config |

## Support

If WebVM still doesn't work after configuring headers:

1. Check browser compatibility (Chrome 92+, Firefox 95+, Safari 15.2+)
2. Verify HTTPS is being used (required for SharedArrayBuffer)
3. Test with a different browser/device
4. Check for corporate firewall restrictions
5. Verify headers are being sent in browser DevTools

For additional help, check the browser console for specific error messages and refer to the WebVM documentation.