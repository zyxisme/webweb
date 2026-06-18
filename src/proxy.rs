// proxy.rs - Proxy logic (request forwarding, response handling)

use axum::extract::Query;
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
pub struct ProxyParams {
    pub url: String,
}

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
