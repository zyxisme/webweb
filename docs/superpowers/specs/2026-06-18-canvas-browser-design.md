# WebWeb 2.0: Canvas Rendering Browser Design

## Overview

WebWeb 2.0 is a complete architectural redesign that replaces the current iframe-based approach with a Canvas rendering engine. The backend uses chromiumoxide (Rust Chrome DevTools Protocol client) to manage headless Chrome instances, and the frontend renders web content on Canvas 2D.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Canvas)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Layout Engine│  │ Paint Engine│  │ Event Handler│     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│           ▲              │               │              │
│           │              ▼               ▼              │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Canvas 2D Context                      │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket (binary protocol)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (Rust + Axum + chromiumoxide)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Tab Manager  │  │ DOM Extractor│ │ Input Proxy  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│           │              │               │              │
│           ▼              ▼               ▼              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         chromiumoxide (CDP)                      │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ Chrome DevTools Protocol
                         ▼
                  ┌─────────────┐
                  │   Chrome    │
                  │  (headless) │
                  └─────────────┘
```

## Technical Stack

### Backend
- **Rust** - Systems language for performance
- **Axum 0.7** - HTTP framework
- **chromiumoxide 0.7** - Chrome DevTools Protocol client
- **tokio** - Async runtime
- **tokio-tungstenite** - WebSocket support

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Canvas 2D API** - Rendering engine
- **WebSocket** - Real-time communication

## Core Components

### 1. Backend: chromiumoxide Integration

**Tab Lifecycle:**
```
Create Tab → Launch Chrome Tab (CDP) → Extract DOM → Push to Frontend
     ↓
User Input → Frontend sends event → Backend forwards to CDP → Chrome processes → DOM update → Push
     ↓
Close Tab → Close CDP connection → Cleanup resources
```

**DOM Extraction Flow (per frame or on-demand):**
1. `DOM.getDocument` - Get DOM tree structure
2. `CSS.getComputedStyleForNode` - Get computed styles for each node
3. `DOM.getBoxModel` - Get layout positions for each node
4. Serialize to compact format, push via WebSocket

**Event Forwarding:**
- Mouse click/move → `Input.dispatchMouseEvent`
- Keyboard input → `Input.dispatchKeyEvent`
- Scroll → `Input.dispatchMouseEvent` (wheel)

### 2. Frontend: Canvas Rendering Engine

**Rendering Pipeline:**
```
Serialized DOM → Layout → Paint → Composite → Display
(Backend)      (Layout) (Paint) (Composite) (Canvas)
```

**Core Modules:**

| Module | Responsibility |
|--------|----------------|
| `DOMDeserializer` | Parse binary DOM data from backend |
| `LayoutEngine` | Calculate node positions and sizes (Box Model, Flexbox, Grid) |
| `PaintEngine` | Render nodes to offscreen Canvas (text, images, backgrounds, borders) |
| `Compositor` | Composite layers, handle z-index, overflow, opacity |
| `EventMapper` | Map Canvas coordinates to DOM nodes, forward user input |

**Rendering Flow:**
1. Receive WebSocket message (binary DOM diff)
2. Update virtual DOM tree
3. Recalculate layout (only changed parts)
4. Paint to offscreen Canvas
5. Composite to main Canvas
6. Drive with requestAnimationFrame

**CSS Support Scope (browser-level):**
- Box Model: margin, padding, border, box-sizing
- Layout: display, position, float, flexbox, grid
- Text: font, color, text-align, line-height
- Background: background-color, background-image, gradient
- Border: border-style, border-radius, box-shadow
- Transform: transform, opacity
- Overflow: overflow, clip

### 3. WebSocket Communication Protocol

**Message Format (binary + JSON hybrid):**
```
┌──────────┬──────────┬─────────────────────────┐
│ Type (1B)│ Length (4B)│      Payload           │
└──────────┴──────────┴─────────────────────────┘
```

**Message Types:**

| Direction | Type | Description |
|-----------|------|-------------|
| Backend→Frontend | `DOM_FULL` | Complete DOM tree (first load) |
| Backend→Frontend | `DOM_DIFF` | Incremental DOM update |
| Backend→Frontend | `SCROLL` | Scroll position sync |
| Backend→Frontend | `FOCUS` | Focus element change |
| Frontend→Backend | `MOUSE` | Mouse event (x, y, type, button) |
| Frontend→Backend | `KEYBOARD` | Keyboard event (key, code, type) |
| Frontend→Backend | `SCROLL_INPUT` | Scroll input |
| Frontend→Backend | `NAVIGATE` | URL navigation |
| Frontend→Backend | `TAB_CREATE` | Create new tab |
| Frontend→Backend | `TAB_SWITCH` | Switch tab |

**Optimization Strategies:**
- DOM_DIFF uses incremental updates to avoid full transmission
- Text uses font metrics caching to reduce repeated calculations
- Images use WebP compression to reduce transfer size
- Dirty region detection to only repaint changed areas

## Key Challenges and Trade-offs

| Challenge | Description | Solution |
|-----------|-------------|----------|
| **Rendering Performance** | Full CSS rendering is computationally expensive | Dirty region detection + incremental updates + requestAnimationFrame |
| **Text Rendering** | Font loading, text layout complex | Backend preloads fonts, frontend uses Canvas fillText |
| **Image Loading** | Cross-origin images, lazy loading | Backend proxies images, frontend uses Image objects |
| **Form Interaction** | Input fields, dropdowns, checkboxes | Special handling: input fields use overlay DOM elements |
| **Scroll Performance** | Large page scrolling lag | Virtual scrolling + layered rendering |
| **Memory Usage** | Multi-tab Chrome processes | Chrome's --single-process or process pool limits |

## Prerequisites

- **Chrome/Chromium** must be installed on the system
- chromiumoxide will auto-detect Chrome installation path
- Fallback: allow user to specify Chrome path via CLI flag

## Known Limitations

- Video/audio playback requires additional handling (WebRTC stream forwarding)
- WebGL/3D content cannot be rendered via Canvas 2D
- Complex animations may have latency
- Extensions not supported
- Canvas 2D rendering will not be 100% identical to native browser (fonts may differ slightly)

## Comparison with Current Approach

| Dimension | Current (iframe) | New (Canvas) |
|-----------|-----------------|--------------|
| Rendering Fidelity | 100% (native browser) | ~95% (Canvas repaint) |
| Performance | High (hardware accelerated) | Medium (software rendering) |
| Security | Sandbox risks | Complete isolation |
| Customizability | Low (browser limits) | High (full control) |
| Implementation Complexity | Low | Extremely high |

## Implementation Plan

### Phase 1: Backend Foundation
- [ ] Set up Rust project with chromiumoxide
- [ ] Implement Chrome process management
- [ ] Implement CDP connection and basic commands
- [ ] Implement DOM extraction

### Phase 2: WebSocket Communication
- [ ] Set up WebSocket server
- [ ] Implement binary protocol
- [ ] Implement DOM serialization
- [ ] Implement event forwarding

### Phase 3: Frontend Rendering Engine
- [ ] Implement DOM deserializer
- [ ] Implement layout engine (Box Model first)
- [ ] Implement paint engine
- [ ] Implement compositor

### Phase 4: Interaction & Polish
- [ ] Implement event mapping
- [ ] Add Flexbox/Grid support
- [ ] Optimize performance
- [ ] Add tab management UI

## File Structure

```
webweb/
├── Cargo.toml
├── src/
│   ├── main.rs           # Entry point, CLI, server startup
│   ├── browser.rs        # Chrome process management
│   ├── dom.rs            # DOM extraction and serialization
│   ├── ws.rs             # WebSocket handler
│   └── static_files.rs   # Static file serving
├── static/
│   ├── index.html        # Main page
│   ├── css/
│   │   └── style.css     # UI styles
│   └── js/
│       ├── renderer/
│       │   ├── dom-deserializer.js
│       │   ├── layout-engine.js
│       │   ├── paint-engine.js
│       │   ├── compositor.js
│       │   └── event-mapper.js
│       ├── ws-client.js  # WebSocket client
│       ├── tab-manager.js
│       └── app.js        # Main app logic
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-18-canvas-browser-design.md
```
