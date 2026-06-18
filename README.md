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
- Cross-platform support (Linux, macOS, Windows)
- No CORS limitations
- Automatic port selection
- Modern minimal UI with Google-style design
- Keyboard shortcuts: Ctrl+T/W/+/-/0
- Favicon display and title sync
- Collapsible sidebar layout

## Development

```bash
cargo run
```

## Building

```bash
# Current platform
cargo build --release

# Cross-platform (requires toolchains)
./build.sh --all
```

## Architecture

```
webweb/
├── src/
│   ├── main.rs         # Entry point, CLI parsing, server startup
│   ├── proxy.rs        # Proxy handler (request forwarding, header filtering)
│   └── static_files.rs # Static file serving with rust-embed
├── static/             # Frontend files (embedded at compile time)
│   ├── index.html
│   ├── sw.js           # Minimal Service Worker (URL rewriting only)
│   ├── css/
│   └── js/
└── build.sh            # Cross-platform build script
```

## How It Works

1. Rust backend serves static files and handles proxy requests
2. Service Worker rewrites URLs to route through the backend proxy
3. Proxy strips security headers (X-Frame-Options, CSP) and adds CORS headers
4. iframes load proxied content without cross-origin restrictions

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |

## License

MIT
