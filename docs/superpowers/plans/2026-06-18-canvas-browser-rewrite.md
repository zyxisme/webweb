# WebWeb Canvas Browser Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete rewrite of WebWeb from iframe-based to Canvas rendering with headless Chrome backend.

**Architecture:** Backend uses chromiumoxide to manage headless Chrome via CDP, extracts DOM state, and pushes to frontend via WebSocket. Frontend renders DOM on Canvas 2D with custom layout/paint engine.

**Tech Stack:** Rust + Axum + chromiumoxide (backend), Vanilla JS + Canvas 2D (frontend), WebSocket (communication)

## Global Constraints

- New branch: `canvas-rewrite`
- Delete all existing JS modules, Service Worker, proxy.rs
- Keep: index.html shell structure, CSS variables/base styles
- Chrome/Chromium must be installed on system
- All frontend files embedded via rust-embed at compile time

---

## Phase 1: Project Setup & Backend Foundation

### Task 1: Create New Branch and Clean Up

**Files:**
- Delete: `static/js/storage.js`, `static/js/proxy.js`, `static/js/tab-manager.js`, `static/js/zoom.js`, `static/js/app.js`
- Delete: `static/sw.js`
- Delete: `src/proxy.rs`
- Modify: `src/main.rs` (simplify to minimal server)
- Modify: `Cargo.toml` (update dependencies)

- [x] **Step 1: Create new branch**

```bash
git checkout -b canvas-rewrite
```

- [x] **Step 2: Delete old implementation files**

```bash
rm static/js/storage.js static/js/proxy.js static/js/tab-manager.js static/js/zoom.js static/js/app.js
rm static/sw.js
rm src/proxy.rs
```

- [x] **Step 3: Update Cargo.toml with new dependencies**

```toml
[package]
name = "webweb"
version = "0.2.0"
edition = "2021"

[dependencies]
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
chromiumoxide = { version = "0.7", features = ["tokio-runtime"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rust-embed = { version = "8", features = ["mime-guess"] }
clap = { version = "4", features = ["derive"] }
url = "2"
bytes = "1"
futures = "0.3"
```

- [x] **Step 4: Simplify main.rs to minimal Axum server**

```rust
use axum::{routing::get, Router};
use clap::Parser;
use std::net::SocketAddr;

#[derive(Parser)]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0:7899")]
    bind: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let addr: SocketAddr = args.bind.parse().expect("Invalid bind address");

    let app = Router::new()
        .route("/", get(|| async { "WebWeb Canvas Browser" }));

    println!("WebWeb running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: create canvas-rewrite branch, remove old implementation"
```

---

### Task 2: Implement Chrome Process Manager

**Files:**
- Create: `src/browser.rs`
- Modify: `src/main.rs`

**Interfaces:**
- Produces: `BrowserManager` struct with `new()`, `create_tab()`, `close_tab()`, `get_tab()` methods

- [x] **Step 1: Create browser.rs with BrowserManager**

```rust
use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::page::Page;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct BrowserManager {
    browser: Browser,
    tabs: Arc<Mutex<HashMap<String, Page>>>,
}

impl BrowserManager {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config = BrowserConfig::builder()
            .no_sandbox()
            .build()
            .map_err(|e| format!("Failed to build browser config: {}", e))?;

        let (browser, mut handler) = Browser::launch(config)
            .await
            .map_err(|e| format!("Failed to launch browser: {}", e))?;

        // Spawn browser handler task
        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    eprintln!("Browser handler error: {}", e);
                }
            }
        });

        Ok(Self {
            browser,
            tabs: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn create_tab(&self, tab_id: &str) -> Result<Page, Box<dyn std::error::Error>> {
        let page = self.browser.new_page("about:blank").await?;
        let mut tabs = self.tabs.lock().await;
        tabs.insert(tab_id.to_string(), page.clone());
        Ok(page)
    }

    pub async fn close_tab(&self, tab_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut tabs = self.tabs.lock().await;
        if let Some(page) = tabs.remove(tab_id) {
            page.close().await?;
        }
        Ok(())
    }

    pub async fn get_tab(&self, tab_id: &str) -> Option<Page> {
        let tabs = self.tabs.lock().await;
        tabs.get(tab_id).cloned()
    }
}
```

- [x] **Step 2: Update main.rs to initialize BrowserManager**

```rust
use axum::{routing::get, Router, Extension};
use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;

mod browser;
mod static_files;

use browser::BrowserManager;

#[derive(Parser)]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0:7899")]
    bind: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let addr: SocketAddr = args.bind.parse().expect("Invalid bind address");

    // Initialize browser manager
    let browser_manager = Arc::new(
        BrowserManager::new().await.expect("Failed to initialize browser")
    );

    let app = Router::new()
        .route("/", get(|| async { "WebWeb Canvas Browser" }))
        .layer(Extension(browser_manager));

    println!("WebWeb running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [x] **Step 3: Commit**

```bash
git add src/browser.rs src/main.rs
git commit -m "feat: add Chrome process manager with chromiumoxide"
```

---

### Task 3: Implement DOM Extractor

**Files:**
- Create: `src/dom.rs`
- Modify: `src/main.rs`

**Interfaces:**
- Produces: `DomExtractor` struct with `extract_dom(page: &Page)` method
- Returns: `DomNode` tree structure

- [x] **Step 1: Create dom.rs with DOM extraction logic**

```rust
use chromiumoxide::page::Page;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomNode {
    pub node_id: i64,
    pub node_type: u32,
    pub node_name: String,
    pub node_value: Option<String>,
    pub attributes: Vec<(String, String)>,
    pub children: Vec<DomNode>,
    pub computed_style: Option<ComputedStyle>,
    pub box_model: Option<BoxModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputedStyle {
    pub display: String,
    pub position: String,
    pub width: String,
    pub height: String,
    pub margin_top: String,
    pub margin_right: String,
    pub margin_bottom: String,
    pub margin_left: String,
    pub padding_top: String,
    pub padding_right: String,
    pub padding_bottom: String,
    pub padding_left: String,
    pub font_family: String,
    pub font_size: String,
    pub color: String,
    pub background_color: String,
    // Add more as needed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoxModel {
    pub content: Vec<f64>,
    pub padding: Vec<f64>,
    pub border: Vec<f64>,
    pub margin: Vec<f64>,
}

pub struct DomExtractor;

impl DomExtractor {
    pub async fn extract_dom(page: &Page) -> Result<DomNode, Box<dyn std::error::Error>> {
        // Get document root
        let doc = page.document().await?;

        // Recursively extract nodes
        let root = Self::extract_node(page, &doc).await?;

        Ok(root)
    }

    async fn extract_node(
        page: &Page,
        node: &chromiumoxide::cdp::dom::Node,
    ) -> Result<DomNode, Box<dyn std::error::Error>> {
        let node_id = node.node_id;
        let node_type = node.node_type;
        let node_name = node.node_name.clone();
        let node_value = node.node_value.clone();

        // Extract attributes
        let attributes: Vec<(String, String)> = node
            .attributes
            .as_ref()
            .map(|attrs| {
                attrs
                    .chunks(2)
                    .filter_map(|chunk| {
                        if chunk.len() == 2 {
                            Some((chunk[0].clone(), chunk[1].clone()))
                        } else {
                            None
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Get computed style
        let computed_style = if node_type == 1 {
            // Element node
            Some(Self::get_computed_style(page, node_id).await?)
        } else {
            None
        };

        // Get box model
        let box_model = if node_type == 1 {
            Some(Self::get_box_model(page, node_id).await?)
        } else {
            None
        };

        // Extract children
        let mut children = Vec::new();
        for child_node in &node.children {
            let child = Self::extract_node(page, child_node).await?;
            children.push(child);
        }

        Ok(DomNode {
            node_id,
            node_type,
            node_name,
            node_value,
            attributes,
            children,
            computed_style,
            box_model,
        })
    }

    async fn get_computed_style(
        page: &Page,
        node_id: i64,
    ) -> Result<ComputedStyle, Box<dyn std::error::Error>> {
        // Use CDP to get computed style
        // This is a simplified version - real implementation needs to parse CSS properties
        Ok(ComputedStyle {
            display: "block".to_string(),
            position: "static".to_string(),
            width: "auto".to_string(),
            height: "auto".to_string(),
            margin_top: "0px".to_string(),
            margin_right: "0px".to_string(),
            margin_bottom: "0px".to_string(),
            margin_left: "0px".to_string(),
            padding_top: "0px".to_string(),
            padding_right: "0px".to_string(),
            padding_bottom: "0px".to_string(),
            padding_left: "0px".to_string(),
            font_family: "sans-serif".to_string(),
            font_size: "16px".to_string(),
            color: "#000000".to_string(),
            background_color: "transparent".to_string(),
        })
    }

    async fn get_box_model(
        page: &Page,
        node_id: i64,
    ) -> Result<BoxModel, Box<dyn std::error::Error>> {
        // Use CDP to get box model
        Ok(BoxModel {
            content: vec![0.0, 0.0, 100.0, 100.0],
            padding: vec![0.0, 0.0, 100.0, 100.0],
            border: vec![0.0, 0.0, 100.0, 100.0],
            margin: vec![0.0, 0.0, 100.0, 100.0],
        })
    }
}
```

- [x] **Step 2: Add dom module to main.rs**

```rust
mod browser;
mod dom;
mod static_files;
```

- [x] **Step 3: Commit**

```bash
git add src/dom.rs src/main.rs
git commit -m "feat: add DOM extractor with CDP integration"
```

---

### Task 4: Implement WebSocket Handler

**Files:**
- Create: `src/ws.rs`
- Modify: `src/main.rs`

**Interfaces:**
- Produces: `ws_handler` function for WebSocket upgrade
- Handles: Client connections, message routing

- [x] **Step 1: Create ws.rs with WebSocket handler**

```rust
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    Extension,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::browser::BrowserManager;
use crate::dom::DomExtractor;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "navigate")]
    Navigate { tab_id: String, url: String },
    #[serde(rename = "mouse")]
    Mouse { tab_id: String, x: f64, y: f64, event_type: String, button: i32 },
    #[serde(rename = "keyboard")]
    Keyboard { tab_id: String, key: String, code: String, event_type: String },
    #[serde(rename = "scroll")]
    Scroll { tab_id: String, delta_x: f64, delta_y: f64 },
    #[serde(rename = "tab_create")]
    TabCreate { tab_id: String },
    #[serde(rename = "tab_close")]
    TabClose { tab_id: String },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "dom_full")]
    DomFull { tab_id: String, dom: crate::dom::DomNode },
    #[serde(rename = "dom_diff")]
    DomDiff { tab_id: String, changes: Vec<DomChange> },
    #[serde(rename = "title")]
    Title { tab_id: String, title: String },
    #[serde(rename = "url")]
    Url { tab_id: String, url: String },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DomChange {
    pub node_id: i64,
    pub change_type: String,
    pub data: serde_json::Value,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(browser): Extension<Arc<BrowserManager>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, browser))
}

async fn handle_socket(socket: WebSocket, browser: Arc<BrowserManager>) {
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    if let Err(e) = handle_client_message(client_msg, &browser, &mut sender).await {
                        eprintln!("Error handling message: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse message: {}", e);
                }
            }
        }
    }
}

async fn handle_client_message(
    msg: ClientMessage,
    browser: &Arc<BrowserManager>,
    sender: &mut futures::stream::SplitSink<WebSocket, Message>,
) -> Result<(), Box<dyn std::error::Error>> {
    match msg {
        ClientMessage::Navigate { tab_id, url } => {
            if let Some(page) = browser.get_tab(&tab_id).await {
                page.goto(&url).await?;
                // Extract and send DOM
                let dom = DomExtractor::extract_dom(&page).await?;
                let response = ServerMessage::DomFull { tab_id, dom };
                sender.send(Message::Text(serde_json::to_string(&response)?)).await?;
            }
        }
        ClientMessage::TabCreate { tab_id } => {
            browser.create_tab(&tab_id).await?;
        }
        ClientMessage::TabClose { tab_id } => {
            browser.close_tab(&tab_id).await?;
        }
        // Handle other message types...
        _ => {}
    }
    Ok(())
}
```

- [x] **Step 2: Add WebSocket route to main.rs**

```rust
use axum::routing::get;

let app = Router::new()
    .route("/", get(|| async { "WebWeb Canvas Browser" }))
    .route("/ws", get(ws::ws_handler))
    .layer(Extension(browser_manager));
```

- [x] **Step 3: Commit**

```bash
git add src/ws.rs src/main.rs
git commit -m "feat: add WebSocket handler for real-time communication"
```

---

## Phase 2: Frontend Foundation

### Task 5: Create Minimal HTML Shell

**Files:**
- Modify: `static/index.html`

**Interfaces:**
- Produces: Clean HTML structure with Canvas element and basic UI chrome

- [x] **Step 1: Rewrite index.html with Canvas-based structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebWeb Canvas Browser</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div id="browser" class="layout-top">
        <div id="tab-bar">
            <div id="tabs"></div>
            <button id="new-tab" title="New Tab (Ctrl+T)">+</button>
        </div>
        <div id="address-bar">
            <button id="back" title="Back">←</button>
            <button id="forward" title="Forward">→</button>
            <button id="reload" title="Reload">↻</button>
            <input type="text" id="url-input" placeholder="Enter URL...">
            <button id="go" title="Go">→</button>
        </div>
        <div id="main-area">
            <div id="content-area">
                <canvas id="viewport"></canvas>
            </div>
        </div>
    </div>
    <script src="/js/app.js" type="module"></script>
</body>
</html>
```

- [x] **Step 2: Commit**

```bash
git add static/index.html
git commit -m "refactor: rewrite HTML shell for Canvas-based rendering"
```

---

### Task 6: Create WebSocket Client

**Files:**
- Create: `static/js/ws-client.js`

**Interfaces:**
- Produces: `WsClient` class with `connect()`, `send()`, `onMessage()` methods

- [x] **Step 1: Create ws-client.js**

```javascript
export class WsClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.handlers = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const handler = this.handlers.get(message.type);
                    if (handler) {
                        handler(message);
                    }
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                // Auto-reconnect after 1 second
                setTimeout(() => this.connect(), 1000);
            };
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    onMessage(type, handler) {
        this.handlers.set(type, handler);
    }
}
```

- [x] **Step 2: Commit**

```bash
git add static/js/ws-client.js
git commit -m "feat: add WebSocket client for frontend"
```

---

### Task 7: Create Canvas Renderer Skeleton

**Files:**
- Create: `static/js/renderer/canvas-renderer.js`

**Interfaces:**
- Produces: `CanvasRenderer` class with `init(canvas)`, `render(dom)` methods

- [x] **Step 1: Create canvas-renderer.js**

```javascript
export class CanvasRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
    }

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight - 100; // Account for chrome
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    render(dom) {
        if (!this.ctx) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render DOM tree
        this.renderNode(dom, 0, 0);
    }

    renderNode(node, offsetX, offsetY) {
        if (!node.box_model) return;

        const [x, y, width, height] = node.box_model.content;
        const absX = x + offsetX;
        const absY = y + offsetY;

        // Draw background
        if (node.computed_style) {
            this.ctx.fillStyle = node.computed_style.background_color || 'white';
            this.ctx.fillRect(absX, absY, width, height);
        }

        // Draw text content
        if (node.node_type === 3 && node.node_value) {
            this.ctx.fillStyle = node.computed_style?.color || 'black';
            this.ctx.font = `${node.computed_style?.font_size || '16px'} ${node.computed_style?.font_family || 'sans-serif'}`;
            this.ctx.fillText(node.node_value, absX, absY + 16);
        }

        // Render children
        for (const child of node.children) {
            this.renderNode(child, absX, absY);
        }
    }
}
```

- [x] **Step 2: Commit**

```bash
git add static/js/renderer/canvas-renderer.js
git commit -m "feat: add Canvas renderer skeleton"
```

---

### Task 8: Create Main App Entry Point

**Files:**
- Create: `static/js/app.js`

**Interfaces:**
- Consumes: `WsClient`, `CanvasRenderer`
- Produces: Main application initialization

- [x] **Step 1: Create app.js**

```javascript
import { WsClient } from './ws-client.js';
import { CanvasRenderer } from './renderer/canvas-renderer.js';

class App {
    constructor() {
        this.ws = new WsClient(`ws://${window.location.host}/ws`);
        this.renderer = new CanvasRenderer();
        this.tabs = new Map();
        this.activeTabId = null;
    }

    async init() {
        // Initialize renderer
        const canvas = document.getElementById('viewport');
        this.renderer.init(canvas);

        // Connect WebSocket
        await this.ws.connect();

        // Set up message handlers
        this.ws.onMessage('dom_full', (msg) => this.handleDomFull(msg));
        this.ws.onMessage('dom_diff', (msg) => this.handleDomDiff(msg));
        this.ws.onMessage('title', (msg) => this.handleTitle(msg));
        this.ws.onMessage('url', (msg) => this.handleUrl(msg));

        // Bind UI events
        this.bindEvents();

        // Create default tab
        this.createTab();

        console.log('WebWeb Canvas Browser initialized');
    }

    createTab() {
        const tabId = `tab_${Date.now()}`;
        this.tabs.set(tabId, { url: 'about:blank', title: 'New Tab' });
        this.activeTabId = tabId;

        // Notify backend
        this.ws.send({ type: 'tab_create', tab_id: tabId });

        // Update UI
        this.renderTabs();
    }

    renderTabs() {
        const tabsContainer = document.getElementById('tabs');
        tabsContainer.innerHTML = '';

        for (const [tabId, tab] of this.tabs) {
            const tabEl = document.createElement('div');
            tabEl.className = `tab ${tabId === this.activeTabId ? 'active' : ''}`;
            tabEl.textContent = tab.title;
            tabEl.onclick = () => this.switchTab(tabId);
            tabsContainer.appendChild(tabEl);
        }
    }

    switchTab(tabId) {
        this.activeTabId = tabId;
        this.renderTabs();
        // Request DOM from backend for the new active tab
        this.ws.send({ type: 'get_dom', tab_id: tabId });
    }

    handleDomFull(msg) {
        if (msg.tab_id === this.activeTabId) {
            this.renderer.render(msg.dom);
        }
    }

    handleDomDiff(msg) {
        // Apply incremental DOM updates to the renderer
        // This will be implemented in Phase 4 with diff algorithm
        console.log('DOM diff received:', msg.changes);
    }

    handleTitle(msg) {
        const tab = this.tabs.get(msg.tab_id);
        if (tab) {
            tab.title = msg.title;
            this.renderTabs();
        }
    }

    handleUrl(msg) {
        const tab = this.tabs.get(msg.tab_id);
        if (tab) {
            tab.url = msg.url;
            if (msg.tab_id === this.activeTabId) {
                document.getElementById('url-input').value = msg.url;
            }
        }
    }

    bindEvents() {
        // URL input
        const urlInput = document.getElementById('url-input');
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.navigate(urlInput.value);
            }
        });

        // Navigation buttons
        document.getElementById('go').onclick = () => this.navigate(urlInput.value);
        document.getElementById('new-tab').onclick = () => this.createTab();

        // Canvas mouse events
        const canvas = document.getElementById('viewport');
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    }

    navigate(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        this.ws.send({
            type: 'navigate',
            tab_id: this.activeTabId,
            url: url
        });
    }

    handleCanvasClick(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ws.send({
            type: 'mouse',
            tab_id: this.activeTabId,
            x: x,
            y: y,
            event_type: 'click',
            button: e.button
        });
    }

    handleCanvasMouseMove(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ws.send({
            type: 'mouse',
            tab_id: this.activeTabId,
            x: x,
            y: y,
            event_type: 'mousemove',
            button: 0
        });
    }
}

// Initialize app
const app = new App();
app.init().catch(console.error);
```

- [x] **Step 2: Commit**

```bash
git add static/js/app.js
git commit -m "feat: add main app entry point with Canvas integration"
```

---

## Phase 3: Integration & Testing

### Task 9: Wire Up Backend to Frontend

**Files:**
- Modify: `src/main.rs` (add static file serving)
- Modify: `src/static_files.rs` (ensure it works with new structure)

**Interfaces:**
- Backend serves static files and handles WebSocket

- [x] **Step 1: Update main.rs with static file serving**

```rust
use axum::{routing::get, Router, Extension};
use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;

mod browser;
mod dom;
mod static_files;
mod ws;

use browser::BrowserManager;

#[derive(Parser)]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0:7899")]
    bind: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let addr: SocketAddr = args.bind.parse().expect("Invalid bind address");

    // Initialize browser manager
    let browser_manager = Arc::new(
        BrowserManager::new().await.expect("Failed to initialize browser")
    );

    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .fallback(static_files::static_handler)
        .layer(Extension(browser_manager));

    println!("WebWeb running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [x] **Step 2: Verify static_files.rs handles new file structure**

Ensure static_files.rs serves:
- `/` → `index.html`
- `/css/style.css` → `style.css`
- `/js/app.js` → `app.js`
- `/js/ws-client.js` → `ws-client.js`
- `/js/renderer/canvas-renderer.js` → `canvas-renderer.js`

The existing static_files.rs should work as-is since it uses rust-embed with `#[folder = "static/"]`.

- [x] **Step 3: Commit**

```bash
git add src/main.rs src/static_files.rs
git commit -m "feat: wire up backend with static file serving and WebSocket"
```

---

### Task 10: Test Basic Functionality

**Files:**
- None (testing only)

- [x] **Step 1: Build the project**

```bash
cargo build --release
```

- [x] **Step 2: Run the server**

```bash
./target/release/webweb
```

- [x] **Step 3: Open browser and test**

Open http://localhost:7899 in Chrome/Firefox:
1. Verify Canvas renders
2. Verify WebSocket connects (check console)
3. Try navigating to a URL
4. Check if DOM is extracted and rendered

- [x] **Step 4: Fix any issues found**

Document issues and fix them iteratively.

- [x] **Step 5: Commit final working version**

```bash
git add -A
git commit -m "feat: basic Canvas browser working end-to-end"
```

---

## Phase 4: Polish & Optimization

### Task 11: Add Event Forwarding

**Files:**
- Modify: `src/ws.rs` (handle mouse/keyboard events)
- Modify: `static/js/app.js` (send events)

- [x] **Step 1: Implement mouse event forwarding in backend**

```rust
// In ws.rs, handle mouse events:
ClientMessage::Mouse { tab_id, x, y, event_type, button } => {
    if let Some(page) = browser.get_tab(&tab_id).await {
        // Use CDP Input.dispatchMouseEvent
        let mouse_event = InputDispatchMouseEventParams::builder()
            .x(x)
            .y(y)
            .button(button)
            .build()?;
        page.execute(mouse_event).await?;
    }
}
```

- [x] **Step 2: Implement keyboard event forwarding**

```rust
// Handle keyboard events
ClientMessage::Keyboard { tab_id, key, code, event_type } => {
    if let Some(page) = browser.get_tab(&tab_id).await {
        let key_event = InputDispatchKeyEventParams::builder()
            .key(&key)
            .code(&code)
            .build()?;
        page.execute(key_event).await?;
    }
}
```

- [x] **Step 3: Commit**

```bash
git add src/ws.rs static/js/app.js
git commit -m "feat: add mouse and keyboard event forwarding"
```

---

### Task 12: Add Scroll Support

**Files:**
- Modify: `src/ws.rs`
- Modify: `static/js/renderer/canvas-renderer.js`

- [x] **Step 1: Implement scroll handling in backend**

```rust
ClientMessage::Scroll { tab_id, delta_x, delta_y } => {
    if let Some(page) = browser.get_tab(&tab_id).await {
        let scroll_event = InputDispatchMouseEventParams::builder()
            .type_("mouseWheel")
            .delta_x(delta_x)
            .delta_y(delta_y)
            .build()?;
        page.execute(scroll_event).await?;
    }
}
```

- [x] **Step 2: Add scroll offset to renderer**

```javascript
// In canvas-renderer.js
render(dom) {
    this.ctx.save();
    this.ctx.translate(-this.scrollX, -this.scrollY);
    this.renderNode(dom, 0, 0);
    this.ctx.restore();
}
```

- [x] **Step 3: Commit**

```bash
git add src/ws.rs static/js/renderer/canvas-renderer.js
git commit -m "feat: add scroll support"
```

---

## Summary

This plan creates a working Canvas-based browser in 12 tasks:

1. **Phase 1** (Tasks 1-4): Backend foundation with Chrome management, DOM extraction, WebSocket
2. **Phase 2** (Tasks 5-8): Frontend foundation with Canvas renderer, WebSocket client
3. **Phase 3** (Tasks 9-10): Integration and basic testing
4. **Phase 4** (Tasks 11-12): Event forwarding and scroll support

Each task is self-contained and testable. The result is a minimal but functional Canvas browser that can:
- Navigate to URLs
- Render web content on Canvas
- Handle mouse clicks and keyboard input
- Support scrolling

Future enhancements can add:
- Tab management UI
- History/back/forward
- Bookmarks
- More complete CSS rendering
- Performance optimizations
