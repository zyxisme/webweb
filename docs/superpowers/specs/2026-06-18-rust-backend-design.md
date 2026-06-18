# Rust Backend Design Specification

**Date:** 2026-06-18
**Status:** Draft
**Author:** Claude (with user guidance)

## Overview

Convert webweb from a pure frontend + Service Worker proxy architecture to a Rust backend architecture. The backend serves static files and handles all proxy requests, eliminating CORS limitations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Single Binary (webweb)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Axum       │  │   Proxy      │  │   Static Files   │  │
│  │   Server     │──│   Handler    │  │   (embedded)     │  │
│  │              │  │              │  │                  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Browser            │
│  ┌────────────────┐ │
│  │  Service Worker│ │  ← Minimal: only URL rewriting
│  │  (sw.js)       │ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │  WebWeb UI     │ │
│  └────────────────┘ │
└─────────────────────┘
```

### Data Flow

1. User enters URL in WebWeb UI
2. Service Worker intercepts the navigation request
3. Service Worker rewrites URL to `/proxy?url=ENCODED_URL`
4. Browser sends request to Rust backend
5. Backend makes actual HTTP request to target server
6. Backend returns response to browser
7. Browser displays content in iframe

## Module Structure

```
webweb/
├── Cargo.toml
├── src/
│   ├── main.rs          # Entry point, CLI parsing, server startup
│   ├── proxy.rs         # Proxy logic (request forwarding, response handling)
│   └── static_files.rs  # Static file serving with rust-embed
├── static/              # Frontend files (embedded at compile time)
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       ├── proxy.js
│       ├── tab-manager.js
│       ├── zoom.js
│       └── storage.js
└── sw.js               # Service Worker (minimal, URL rewriting only)
```

## Dependencies

```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["cookies"] }
clap = { version = "4", features = ["derive"] }
rust-embed = "8"
```

**Why these dependencies:**
- `axum`: Modern async web framework from Tokio ecosystem
- `tokio`: Async runtime
- `reqwest`: Async HTTP client
- `clap`: CLI argument parsing
- `rust-embed`: Embed static files at compile time

**Note:** Logging uses simple `println!` for basic request/response information.

## Command Line Interface

```bash
webweb [OPTIONS]

Options:
  -b, --bind <ADDRESS>  Bind address [default: 0.0.0.0:7899]
  -h, --help            Print help
  -V, --version         Print version
```

### Examples:
```bash
webweb                    # Listen on 0.0.0.0:7899
webweb -b 127.0.0.1:8080 # Listen on 127.0.0.1:8080
webweb -b 0.0.0.0:9000   # Listen on 0.0.0.0:9000
```

### Port Auto-Increment

If the specified port is busy, automatically try the next port (up to 10 attempts).

**Startup log:**
```
[INFO] Port 7899 is busy, trying 7900...
[INFO] Listening on http://0.0.0.0:7900
```

## Proxy Handler

### Endpoint

```
GET/POST/PUT/DELETE/PATCH /proxy?url=ENCODED_URL
```

### Request Flow

1. Parse `url` query parameter
2. Create new request to target URL
3. Forward relevant headers from original request
4. **Forward request body** (for POST/PUT/PATCH requests)
5. Execute request with 60-second timeout
6. Return response to client

### Request Body Handling

**Methods that forward request body:**
- `POST` - Create resource
- `PUT` - Update resource (full replacement)
- `PATCH` - Partial update

**Methods without body:**
- `GET` - Read resource
- `DELETE` - Delete resource

**Implementation:**
```rust
// Forward request body if present
let body = if matches!(method, "POST" | "PUT" | "PATCH") {
    request.body().await?
} else {
    Bytes::new()
};

// Set content-length header
if !body.is_empty() {
    headers.insert("content-length", body.len().to_string().parse()?);
}
```

**Body types supported:**
- JSON (`application/json`)
- Form data (`application/x-www-form-urlencoded`)
- Multipart (`multipart/form-data`)
- Raw bytes (`application/octet-stream`)
- Text (`text/plain`)

### Header Handling

**Headers to forward (transparent passthrough):**
- `Host` - Original target host
- `Origin` - Request origin
- `Referer` - Referrer URL
- `Cookie` - Client cookies for target domain
- `User-Agent` - Browser user agent
- `Accept` - Content type preferences
- `Accept-Language` - Language preferences
- `Accept-Encoding` - Encoding preferences
- `Content-Type` - Request body type
- `Content-Length` - Request body length

**Headers NOT forwarded:**
- `X-Frame-Options` - Blocks iframe embedding
- `Content-Security-Policy` - Blocks iframe embedding
- `X-Content-Type-Options` - Can block content loading
- `Strict-Transport-Security` - Can cause redirect issues

### Response Headers

**Headers to remove from response:**
- `X-Frame-Options`
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `Strict-Transport-Security`

**Headers to add to response:**
- `Access-Control-Allow-Origin: *` - Enable CORS if needed

### Timeout

- Default timeout: 60 seconds
- Applies to connection + response time

### Error Handling

Return detailed error information for debugging:
```json
{
  "error": "Failed to fetch URL",
  "message": "Connection timed out after 60 seconds",
  "url": "https://example.com"
}
```

### Logging

**Default logging level:** Detailed (includes request/response information)

**Request logging:**
```
[PROXY] GET https://example.com/api/data
[PROXY] Headers: Host=example.com, User-Agent=Mozilla/5.0...
[PROXY] Body: (empty)
```

**Response logging:**
```
[PROXY] Response: 200 OK
[PROXY] Headers: Content-Type=application/json, Content-Length=1234
[PROXY] Body: {"status": "success", "data": {...}}
```

**Error logging:**
```
[PROXY] Error: Connection timed out after 60 seconds
[PROXY] URL: https://example.com/api/data
```

**Implementation:** Simple `println!` with formatted output for readability.

## Static File Serving

### Implementation

Use `rust-embed` to embed static files at compile time:

```rust
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "static/"]
struct StaticFiles;
```

### Routes

- `/` → `index.html`
- `/css/style.css` → `css/style.css`
- `/js/app.js` → `js/app.js`
- `/sw.js` → `sw.js`
- (all files in `/static/` directory)

### MIME Type Detection

`rust-embed` automatically detects MIME types based on file extensions.

## Service Worker (Minimal)

### Responsibility

Only URL rewriting - intercept iframe requests and rewrite to backend proxy format.

### Implementation

```javascript
// sw.js - Minimal Service Worker
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip proxy requests (already rewritten)
  if (url.pathname === '/proxy') return;

  // Skip non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Rewrite to proxy format
  const proxyUrl = `/proxy?url=${encodeURIComponent(url.href)}`;

  event.respondWith(fetch(proxyUrl));
});
```

### Key Points

- No request modification (headers, cookies handled by backend)
- No response modification (backend handles security headers)
- Simple URL rewriting only

## Cross-Platform Compilation

### Build Targets

- Linux: `x86_64-unknown-linux-gnu`
- macOS: `x86_64-apple-darwin` (Intel), `aarch64-apple-darwin` (Apple Silicon)
- Windows: `x86_64-pc-windows-msvc`

### Build Command

```bash
# Build for current platform
cargo build --release

# Cross-compile for Linux
cargo build --release --target x86_64-unknown-linux-gnu

# Cross-compile for macOS
cargo build --release --target x86_64-apple-darwin

# Cross-compile for Windows
cargo build --release --target x86_64-pc-windows-msvc
```

### Binary Output

Single binary file: `webweb` (or `webweb.exe` on Windows)

## Deployment

### Distribution

1. Download binary for your platform
2. Run: `./webweb`
3. Open browser: `http://localhost:7899`

### No Dependencies Required

- No Node.js
- No Python
- No server configuration
- Single binary, run anywhere

## Migration Path

### Phase 1: Create Rust Backend
1. Create Cargo.toml with dependencies
2. Implement static file serving
3. Implement proxy handler
4. Test basic functionality

### Phase 2: Simplify Service Worker
1. Remove complex proxy logic from sw.js
2. Keep only URL rewriting
3. Test iframe loading

### Phase 3: Build & Distribute
1. Set up cross-compilation
2. Build binaries for all platforms
3. Test on each platform
4. Update documentation

## Success Criteria

1. ✅ Single binary runs without dependencies
2. ✅ All existing webweb features work
3. ✅ No CORS limitations
4. ✅ Cross-platform support
5. ✅ Simple deployment (download and run)
