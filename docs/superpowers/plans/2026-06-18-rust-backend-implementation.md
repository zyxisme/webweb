# Rust Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert webweb to a Rust backend that serves static files and proxies requests, eliminating CORS limitations.

**Architecture:** Single Rust binary with Axum web server, embedded static files via rust-embed, and proxy handler that forwards requests transparently.

**Tech Stack:** Rust, Axum, Tokio, reqwest, clap, rust-embed

## Global Constraints

- Default bind address: `0.0.0.0:7899`
- Proxy timeout: 60 seconds
- Port auto-increment: try 10 ports max
- Logging: simple `println!` for request/response details
- Headers: transparent passthrough (Host, Origin, Referer, Cookie)
- Security headers removed: X-Frame-Options, CSP, X-Content-Type-Options, HSTS

---

### Task 1: Create Cargo.toml and Project Structure

**Files:**
- Create: `Cargo.toml`
- Create: `src/main.rs` (empty placeholder)
- Create: `src/proxy.rs` (empty placeholder)
- Create: `src/static_files.rs` (empty placeholder)
- Create: `static/` directory

**Interfaces:**
- Produces: Project structure ready for implementation

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "webweb"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["cookies"] }
clap = { version = "4", features = ["derive"] }
rust-embed = "8"
```

- [ ] **Step 2: Create source directory and placeholder files**

```bash
mkdir -p src static
touch src/main.rs src/proxy.rs src/static_files.rs
```

- [ ] **Step 3: Verify project structure**

```bash
ls -la Cargo.toml src/ static/
```

Expected:
```
Cargo.toml
src/main.rs
src/proxy.rs
src/static_files.rs
static/
```

- [ ] **Step 4: Commit**

```bash
git add Cargo.toml src/ static/
git commit -m "feat: initialize Rust project structure with dependencies"
```

---

### Task 2: Implement Static File Serving

**Files:**
- Modify: `src/static_files.rs`
- Create: `static/index.html` (copy from current `index.html`)
- Create: `static/css/style.css` (copy from current `css/style.css`)
- Create: `static/js/app.js` (copy from current `js/app.js`)
- Create: `static/js/proxy.js` (copy from current `js/proxy.js`)
- Create: `static/js/tab-manager.js` (copy from current `js/tab-manager.js`)
- Create: `static/js/zoom.js` (copy from current `js/zoom.js`)
- Create: `static/js/storage.js` (copy from current `js/storage.js`)
- Create: `static/sw.js` (copy from current `sw.js`)

**Interfaces:**
- Produces: `StaticFiles` struct with `get(path: &str) -> Option<(ContentType, Vec<u8>)>` method

- [ ] **Step 1: Copy existing frontend files to static directory**

```bash
cp index.html static/
cp -r css static/
cp -r js static/
cp sw.js static/
```

- [ ] **Step 2: Implement static file handler**

```rust
// src/static_files.rs
use axum::http::StatusCode;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "static/"]
struct StaticFiles;

pub async fn static_handler(path: &str) -> Result<(axum::http::HeaderMap, Vec<u8>), StatusCode> {
    let path = path.trim_start_matches('/');

    match StaticFiles::get(path) {
        Some(content) => {
            let mut headers = axum::http::HeaderMap::new();
            headers.insert(
                "content-type",
                content.metadata.mimetype().parse().unwrap(),
            );
            Ok((headers, content.data.to_vec()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
```

- [ ] **Step 3: Verify static file serving**

```bash
cargo check
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/static_files.rs static/
git commit -m "feat: implement static file serving with rust-embed"
```

---

### Task 3: Implement Proxy Handler

**Files:**
- Modify: `src/proxy.rs`

**Interfaces:**
- Consumes: `reqwest::Client` for making HTTP requests
- Produces: `proxy_handler(axum::extract::Query<ProxyParams>, axum::http::Method, axum::http::HeaderMap, axum::body::Bytes) -> Response`

- [ ] **Step 1: Define proxy parameters struct**

```rust
// src/proxy.rs
use axum::extract::Query;
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
pub struct ProxyParams {
    pub url: String,
}
```

- [ ] **Step 2: Implement header filtering logic**

```rust
const BLOCKED_REQUEST_HEADERS: &[&str] = &[
    "host",
    "origin",
    "referer",
    "cookie",
    "x-frame-options",
    "content-security-policy",
    "x-content-type-options",
    "strict-transport-security",
];

const BLOCKED_RESPONSE_HEADERS: &[&str] = &[
    "x-frame-options",
    "content-security-policy",
    "x-content-type-options",
    "strict-transport-security",
];

fn filter_request_headers(headers: &HeaderMap) -> HeaderMap {
    let mut filtered = HeaderMap::new();
    for (name, value) in headers.iter() {
        if !BLOCKED_REQUEST_HEADERS.contains(&name.as_str()) {
            filtered.insert(name.clone(), value.clone());
        }
    }
    filtered
}

fn filter_response_headers(headers: &HeaderMap) -> HeaderMap {
    let mut filtered = HeaderMap::new();
    for (name, value) in headers.iter() {
        if !BLOCKED_RESPONSE_HEADERS.contains(&name.as_str()) {
            filtered.insert(name.clone(), value.clone());
        }
    }
    filtered.insert(
        "access-control-Allow-origin",
        "*".parse().unwrap(),
    );
    filtered
}
```

- [ ] **Step 3: Implement proxy handler function**

```rust
pub async fn proxy_handler(
    Query(params): Query<ProxyParams>,
    method: Method,
    headers: HeaderMap,
    body: bytes::Bytes,
) -> Response {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();

    let filtered_headers = filter_request_headers(&headers);

    let mut request = client.request(method.clone(), &params.url);

    for (name, value) in filtered_headers.iter() {
        request = request.header(name.as_str(), value.as_bytes());
    }

    if matches!(method, Method::POST | Method::PUT | Method::PATCH) {
        request = request.body(body);
    }

    // Log request
    println!("[PROXY] {} {}", method, params.url);

    match request.send().await {
        Ok(response) => {
            let status = response.status();
            let response_headers = response.headers().clone();
            let body = response.bytes().await.unwrap_or_default();

            // Log response
            println!("[PROXY] Response: {} {}", status.as_u16(), status.canonical_reason().unwrap_or(""));

            let mut filtered_response_headers = filter_response_headers(&response_headers);
            filtered_response_headers.insert(
                "content-length",
                body.len().to_string().parse().unwrap(),
            );

            (StatusCode::from_u16(status.as_u16()).unwrap(), filtered_response_headers, body).into_response()
        }
        Err(e) => {
            // Log error
            println!("[PROXY] Error: {}", e);

            let error_response = serde_json::json!({
                "error": "Failed to fetch URL",
                "message": e.to_string(),
                "url": params.url
            });

            (StatusCode::BAD_GATEWAY, error_response.to_string()).into_response()
        }
    }
}
```

- [ ] **Step 4: Verify proxy handler compiles**

```bash
cargo check
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/proxy.rs
git commit -m "feat: implement proxy handler with header filtering and logging"
```

---

### Task 4: Implement CLI and Server Startup

**Files:**
- Modify: `src/main.rs`

**Interfaces:**
- Consumes: `static_files::static_handler`, `proxy::proxy_handler`
- Produces: Running Axum server on configurable bind address

- [ ] **Step 1: Define CLI arguments**

```rust
// src/main.rs
use clap::Parser;
use std::net::SocketAddr;

#[derive(Parser)]
#[command(name = "webweb")]
#[command(about = "A browser tab simulation system with Rust backend")]
struct Cli {
    /// Bind address (default: 0.0.0.0:7899)
    #[arg(short, long, default_value = "0.0.0.0:7899")]
    bind: String,
}
```

- [ ] **Step 2: Implement port auto-increment logic**

```rust
async fn try_bind(addr: &str) -> Result<tokio::net::TcpListener, std::io::Error> {
    let parts: Vec<&str> = addr.split(':').collect();
    if parts.len() != 2 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Invalid address format. Use: 0.0.0.0:7899",
        ));
    }

    let host = parts[0];
    let base_port: u16 = parts[1].parse().map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid port number")
    })?;

    let mut port = base_port;
    loop {
        let bind_addr = format!("{}:{}", host, port);
        match tokio::net::TcpListener::bind(&bind_addr).await {
            Ok(listener) => {
                if port != base_port {
                    println!("[INFO] Port {} is busy, trying {}...", base_port, port);
                }
                println!("[INFO] Listening on http://{}", bind_addr);
                return Ok(listener);
            }
            Err(e) => {
                if port - base_port >= 10 {
                    return Err(e);
                }
                port += 1;
            }
        }
    }
}
```

- [ ] **Step 3: Implement main server setup**

```rust
mod proxy;
mod static_files;

use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let app = Router::new()
        .route("/proxy", post(proxy::proxy_handler))
        .route("/proxy", get(proxy::proxy_handler))
        .route("/", get(|| async { static_files::static_handler("index.html").await }))
        .route("/*path", get(static_handler));

    let listener = try_bind(&cli.bind).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}

async fn static_handler(Path(path): Path<String>) -> impl IntoResponse {
    match static_files::static_handler(&path).await {
        Ok((headers, body)) => (StatusCode::OK, headers, body).into_response(),
        Err(status) => (status, "Not Found").into_response(),
    }
}
```

- [ ] **Step 4: Add serde_json dependency for error responses**

```toml
# Add to Cargo.toml [dependencies]
serde_json = "1"
```

- [ ] **Step 5: Verify main.rs compiles**

```bash
cargo check
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/main.rs Cargo.toml
git commit -m "feat: implement CLI args and server startup with port auto-increment"
```

---

### Task 5: Simplify Service Worker

**Files:**
- Modify: `static/sw.js`

**Interfaces:**
- Produces: Minimal Service Worker that only rewrites URLs to proxy format

- [ ] **Step 1: Replace sw.js with minimal implementation**

```javascript
// sw.js - Minimal Service Worker
// Only rewrites URLs to proxy format, all proxy logic handled by Rust backend

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip proxy requests (already rewritten)
  if (url.pathname === '/proxy') {
    return;
  }

  // Skip non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip requests to the same origin (static files)
  if (url.origin === self.location.origin) {
    return;
  }

  // Rewrite external requests to proxy format
  const proxyUrl = `/proxy?url=${encodeURIComponent(url.href)}`;

  event.respondWith(fetch(proxyUrl, {
    method: event.request.method,
    headers: event.request.headers,
    body: event.request.body
  }));
});
```

- [ ] **Step 2: Verify Service Worker syntax**

```bash
node -c static/sw.js
```

Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add static/sw.js
git commit -m "feat: simplify Service Worker to only URL rewriting"
```

---

### Task 6: Integration Test and Verification

**Files:**
- None (testing existing implementation)

**Interfaces:**
- Verifies: All components work together correctly

- [ ] **Step 1: Build the project**

```bash
cargo build
```

Expected: Successful build

- [ ] **Step 2: Run the server**

```bash
cargo run
```

Expected:
```
[INFO] Listening on http://0.0.0.0:7899
```

- [ ] **Step 3: Test static file serving**

In another terminal:
```bash
curl http://localhost:7899/
```

Expected: HTML content of index.html

- [ ] **Step 4: Test proxy functionality**

```bash
curl "http://localhost:7899/proxy?url=https://httpbin.org/get"
```

Expected: JSON response from httpbin.org

- [ ] **Step 5: Test with browser**

Open `http://localhost:7899` in browser and navigate to a URL.

Expected:
- WebWeb UI loads
- Navigation works through proxy
- No CORS errors

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete Rust backend implementation"
```

---

### Task 7: Cross-Platform Build Setup

**Files:**
- Create: `.cargo/config.toml` (optional, for cross-compilation)

**Interfaces:**
- Produces: Build configuration for cross-platform compilation

- [ ] **Step 1: Install cross-compilation tools (if needed)**

```bash
# For Linux targets
rustup target add x86_64-unknown-linux-gnu

# For macOS targets (if on macOS)
rustup target add x86_64-apple-darwin aarch64-apple-darwin

# For Windows targets
rustup target add x86_64-pc-windows-msvc
```

- [ ] **Step 2: Create build script (optional)**

```bash
#!/bin/bash
# build.sh - Build for multiple platforms

echo "Building for Linux..."
cargo build --release --target x86_64-unknown-linux-gnu

echo "Building for macOS (Intel)..."
cargo build --release --target x86_64-apple-darwin

echo "Building for macOS (Apple Silicon)..."
cargo build --release --target aarch64-apple-darwin

echo "Building for Windows..."
cargo build --release --target x86_64-pc-windows-msvc

echo "Build complete!"
```

- [ ] **Step 3: Make build script executable**

```bash
chmod +x build.sh
```

- [ ] **Step 4: Test current platform build**

```bash
cargo build --release
```

Expected: Binary at `target/release/webweb`

- [ ] **Step 5: Commit**

```bash
git add . cargo/config.toml build.sh
git commit -m "feat: add cross-platform build configuration"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (if exists)

**Interfaces:**
- Produces: Updated documentation reflecting new architecture

- [ ] **Step 1: Update CLAUDE.md with new architecture**

Add to CLAUDE.md:

```markdown
## Rust Backend

webweb now uses a Rust backend for serving static files and proxying requests.

### Running

```bash
cargo run
# or
./target/release/webweb -b 0.0.0.0:7899
```

### Building

```bash
cargo build --release
```

### Architecture

- `src/main.rs` - Entry point, CLI parsing, server startup
- `src/proxy.rs` - Proxy handler (request forwarding, header filtering)
- `src/static_files.rs` - Static file serving with rust-embed
- `static/` - Frontend files (embedded at compile time)
- `sw.js` - Minimal Service Worker (URL rewriting only)
```

- [ ] **Step 2: Create or update README.md**

```markdown
# WebWeb Browser

A browser tab simulation system with Rust backend.

## Quick Start

```bash
# Build
cargo build --release

# Run
./target/release/webweb

# Open browser
open http://localhost:7899
```

## Features

- Single binary, no dependencies
- Cross-platform support
- No CORS limitations
- Automatic port selection

## Development

```bash
cargo run
```

## Building

```bash
cargo build --release
```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update documentation for Rust backend"
```

---

### Task 9: Final Cleanup and Verification

**Files:**
- None (cleanup only)

**Interfaces:**
- Verifies: Project is complete and ready for distribution

- [ ] **Step 1: Remove old Node.js files (if any)**

```bash
# Check for old files
ls -la server.js package.json node_modules/ 2>/dev/null

# Remove if they exist
rm -rf server.js package.json node_modules/
```

- [ ] **Step 2: Update .gitignore**

```bash
# Add to .gitignore
echo "target/" >> .gitignore
echo "Cargo.lock" >> .gitignore
```

- [ ] **Step 3: Final build and test**

```bash
cargo clean
cargo build --release
./target/release/webweb
```

Expected:
- Server starts on port 7899
- Static files serve correctly
- Proxy works in browser

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: cleanup and final verification"
```

- [ ] **Step 5: Create release tag**

```bash
git tag -a v0.1.0 -m "Initial Rust backend release"
git push origin v0.1.0
```

---

## Summary

**Total Tasks:** 9
**Estimated Time:** 2-3 hours
**Dependencies:** Rust toolchain installed

**Key Deliverables:**
1. Single Rust binary with embedded static files
2. Proxy handler with transparent header passthrough
3. Minimal Service Worker for URL rewriting
4. Cross-platform build configuration
5. Updated documentation

**Success Criteria:**
- ✅ `cargo run` starts server on port 7899
- ✅ Static files serve correctly
- ✅ Proxy works without CORS limitations
- ✅ Browser navigation works through proxy
- ✅ Single binary runs without dependencies
