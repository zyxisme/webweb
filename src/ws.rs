// ws.rs - WebSocket handler for frontend-backend communication

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    Extension,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::browser::BrowserManager;
use crate::dom::DomExtractor;

use chromiumoxide::cdp::browser_protocol::input::{
    DispatchKeyEventParams, DispatchKeyEventType, DispatchMouseEventParams, DispatchMouseEventType,
    MouseButton,
};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "navigate")]
    Navigate { tab_id: String, url: String },

    #[serde(rename = "mouse")]
    Mouse {
        tab_id: String,
        x: f64,
        y: f64,
        event_type: String,
        button: i32,
    },

    #[serde(rename = "keyboard")]
    Keyboard {
        tab_id: String,
        key: String,
        code: String,
        event_type: String,
    },

    #[serde(rename = "scroll")]
    Scroll {
        tab_id: String,
        x: f64,
        y: f64,
        delta_x: f64,
        delta_y: f64,
    },

    #[serde(rename = "tab_create")]
    TabCreate { tab_id: String },

    #[serde(rename = "tab_close")]
    TabClose { tab_id: String },

    #[serde(rename = "get_dom")]
    GetDom { tab_id: String },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "dom_full")]
    DomFull {
        tab_id: String,
        dom: serde_json::Value,
    },

    #[serde(rename = "dom_diff")]
    DomDiff {
        tab_id: String,
        changes: Vec<serde_json::Value>,
    },

    #[serde(rename = "title")]
    Title { tab_id: String, title: String },

    #[serde(rename = "url")]
    Url { tab_id: String, url: String },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "tab_created")]
    TabCreated { tab_id: String },

    #[serde(rename = "tab_closed")]
    TabClosed { tab_id: String },

    #[serde(rename = "scroll_update")]
    ScrollUpdate {
        tab_id: String,
        scroll_top: f64,
        scroll_left: f64,
    },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(browser): Extension<Arc<Mutex<BrowserManager>>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, browser))
}

async fn handle_socket(socket: WebSocket, browser: Arc<Mutex<BrowserManager>>) {
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(message)) = receiver.next().await {
        if let Message::Text(text) = message {
            match serde_json::from_str::<ClientMessage>(&text) {
                Ok(msg) => {
                    let response = handle_message(msg, &browser).await;
                    if let Some(resp) = response {
                        if let Ok(json) = serde_json::to_string(&resp) {
                            let _ = sender.send(Message::Text(json.into())).await;
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to parse message: {}", e);
                    let error = ServerMessage::Error {
                        message: format!("Invalid message format: {}", e),
                    };
                    if let Ok(json) = serde_json::to_string(&error) {
                        let _ = sender.send(Message::Text(json.into())).await;
                    }
                }
            }
        }
    }
}

async fn handle_message(
    message: ClientMessage,
    browser: &Arc<Mutex<BrowserManager>>,
) -> Option<ServerMessage> {
    match message {
        ClientMessage::Navigate { tab_id, url } => {
            let browser = browser.lock().await;
            // Convert error to String to avoid holding Box<dyn Error> across await
            let nav_result = browser
                .navigate(&tab_id, &url)
                .await
                .map_err(|e| e.to_string());
            match nav_result {
                Ok(_) => {
                    if let Some(page) = browser.get_tab(&tab_id).await {
                        match DomExtractor::extract_dom(&page).await {
                            Ok(dom) => {
                                let dom_json = serde_json::to_value(&dom).unwrap();
                                Some(ServerMessage::DomFull {
                                    tab_id: tab_id.clone(),
                                    dom: dom_json,
                                })
                            }
                            Err(e) => Some(ServerMessage::Error {
                                message: format!("Failed to extract DOM: {}", e),
                            }),
                        }
                    } else {
                        Some(ServerMessage::Error {
                            message: "Tab not found".to_string(),
                        })
                    }
                }
                Err(e) => Some(ServerMessage::Error {
                    message: format!("Navigation failed: {}", e),
                }),
            }
        }

        ClientMessage::GetDom { tab_id } => {
            let browser = browser.lock().await;
            if let Some(page) = browser.get_tab(&tab_id).await {
                match DomExtractor::extract_dom(&page).await {
                    Ok(dom) => {
                        let dom_json = serde_json::to_value(&dom).unwrap();
                        Some(ServerMessage::DomFull {
                            tab_id: tab_id.clone(),
                            dom: dom_json,
                        })
                    }
                    Err(e) => Some(ServerMessage::Error {
                        message: format!("Failed to extract DOM: {}", e),
                    }),
                }
            } else {
                Some(ServerMessage::Error {
                    message: "Tab not found".to_string(),
                })
            }
        }

        ClientMessage::TabCreate { tab_id } => {
            let browser = browser.lock().await;
            match browser.create_tab(&tab_id).await {
                Ok(_) => Some(ServerMessage::TabCreated { tab_id }),
                Err(e) => Some(ServerMessage::Error {
                    message: format!("Failed to create tab: {}", e),
                }),
            }
        }

        ClientMessage::TabClose { tab_id } => {
            let browser = browser.lock().await;
            match browser.close_tab(&tab_id).await {
                Ok(_) => Some(ServerMessage::TabClosed { tab_id }),
                Err(e) => Some(ServerMessage::Error {
                    message: format!("Failed to close tab: {}", e),
                }),
            }
        }

        ClientMessage::Mouse {
            tab_id,
            x,
            y,
            event_type,
            button,
        } => {
            let browser = browser.lock().await;
            if let Some(page) = browser.get_tab(&tab_id).await {
                // Map frontend event type to CDP mouse event type
                let mouse_event_type = match event_type.as_str() {
                    "mousedown" => DispatchMouseEventType::MousePressed,
                    "mouseup" => DispatchMouseEventType::MouseReleased,
                    "mousemove" => DispatchMouseEventType::MouseMoved,
                    "click" => DispatchMouseEventType::MousePressed,
                    "dblclick" => DispatchMouseEventType::MousePressed,
                    "contextmenu" => DispatchMouseEventType::MousePressed,
                    _ => return None,
                };

                // Map button index to CDP MouseButton
                let mouse_button = match button {
                    0 => MouseButton::Left,
                    1 => MouseButton::Middle,
                    2 => MouseButton::Right,
                    3 => MouseButton::Back,
                    4 => MouseButton::Forward,
                    _ => MouseButton::Left,
                };

                // Determine click count for click/dblclick events
                let click_count = match event_type.as_str() {
                    "click" => 1,
                    "dblclick" => 2,
                    "contextmenu" => 1,
                    _ => 0,
                };

                // Build and execute the mouse event
                let mouse_params = DispatchMouseEventParams::builder()
                    .r#type(mouse_event_type)
                    .x(x)
                    .y(y)
                    .button(mouse_button)
                    .click_count(click_count)
                    .build();

                match mouse_params {
                    Ok(params) => {
                        if let Err(e) = page.execute(params).await {
                            log::error!("Failed to dispatch mouse event: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to build mouse event params: {}", e);
                    }
                }
            }
            None
        }

        ClientMessage::Keyboard {
            tab_id,
            key,
            code,
            event_type,
        } => {
            let browser = browser.lock().await;
            if let Some(page) = browser.get_tab(&tab_id).await {
                // Map frontend event type to CDP key event type
                let key_event_type = match event_type.as_str() {
                    "keydown" => DispatchKeyEventType::KeyDown,
                    "keyup" => DispatchKeyEventType::KeyUp,
                    "keypress" => DispatchKeyEventType::Char,
                    _ => return None,
                };

                // Build and execute the key event
                let key_params = DispatchKeyEventParams::builder()
                    .r#type(key_event_type)
                    .key(&key)
                    .code(&code)
                    .build();

                match key_params {
                    Ok(params) => {
                        if let Err(e) = page.execute(params).await {
                            log::error!("Failed to dispatch key event: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to build key event params: {}", e);
                    }
                }
            }
            None
        }

        ClientMessage::Scroll {
            tab_id,
            x,
            y,
            delta_x,
            delta_y,
        } => {
            let browser = browser.lock().await;
            if let Some(page) = browser.get_tab(&tab_id).await {
                // Use DispatchMouseEvent with MouseWheel type for scroll events
                let scroll_params = DispatchMouseEventParams::builder()
                    .r#type(DispatchMouseEventType::MouseWheel)
                    .x(x)
                    .y(y)
                    .delta_x(delta_x)
                    .delta_y(delta_y)
                    .build();

                match scroll_params {
                    Ok(params) => {
                        if let Err(e) = page.execute(params).await {
                            log::error!("Failed to dispatch scroll event: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to build scroll event params: {}", e);
                    }
                }

                // Get updated scroll position after dispatching the scroll event
                let scroll_top = page
                    .evaluate("window.scrollY")
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()))
                    .unwrap_or(0.0);
                let scroll_left = page
                    .evaluate("window.scrollX")
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()))
                    .unwrap_or(0.0);

                return Some(ServerMessage::ScrollUpdate {
                    tab_id,
                    scroll_top,
                    scroll_left,
                });
            }
            None
        }
    }
}
