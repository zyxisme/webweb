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
    // Host is stripped because reqwest sets it automatically from the target URL
    "host",
    // Security response headers that should not be forwarded in requests
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
        "access-control-allow-origin",
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
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            println!("[PROXY] Failed to create HTTP client: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to initialize HTTP client").into_response();
        }
    };

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

            (StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY), filtered_response_headers, body).into_response()
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn test_filter_request_headers_removes_security_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
        headers.insert("content-security-policy", HeaderValue::from_static("default-src 'self'"));
        headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
        headers.insert("strict-transport-security", HeaderValue::from_static("max-age=31536000"));
        headers.insert("accept", HeaderValue::from_static("text/html"));

        let filtered = filter_request_headers(&headers);

        assert!(filtered.get("x-frame-options").is_none());
        assert!(filtered.get("content-security-policy").is_none());
        assert!(filtered.get("x-content-type-options").is_none());
        assert!(filtered.get("strict-transport-security").is_none());
        assert_eq!(filtered.get("accept").unwrap(), "text/html");
    }

    #[test]
    fn test_filter_request_headers_removes_host() {
        let mut headers = HeaderMap::new();
        headers.insert("host", HeaderValue::from_static("example.com"));
        headers.insert("accept", HeaderValue::from_static("text/html"));

        let filtered = filter_request_headers(&headers);

        assert!(filtered.get("host").is_none());
        assert_eq!(filtered.get("accept").unwrap(), "text/html");
    }

    #[test]
    fn test_filter_request_headers_forwards_origin_referer_cookie() {
        let mut headers = HeaderMap::new();
        headers.insert("origin", HeaderValue::from_static("https://example.com"));
        headers.insert("referer", HeaderValue::from_static("https://example.com/page"));
        headers.insert("cookie", HeaderValue::from_static("session=abc123"));
        headers.insert("accept", HeaderValue::from_static("text/html"));

        let filtered = filter_request_headers(&headers);

        assert_eq!(filtered.get("origin").unwrap(), "https://example.com");
        assert_eq!(filtered.get("referer").unwrap(), "https://example.com/page");
        assert_eq!(filtered.get("cookie").unwrap(), "session=abc123");
        assert_eq!(filtered.get("accept").unwrap(), "text/html");
    }

    #[test]
    fn test_filter_request_headers_empty() {
        let headers = HeaderMap::new();
        let filtered = filter_request_headers(&headers);
        assert!(filtered.is_empty());
    }

    #[test]
    fn test_filter_request_headers_forwards_standard_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("accept", HeaderValue::from_static("text/html"));
        headers.insert("accept-language", HeaderValue::from_static("en-US"));
        headers.insert("user-agent", HeaderValue::from_static("Mozilla/5.0"));
        headers.insert("content-type", HeaderValue::from_static("application/json"));

        let filtered = filter_request_headers(&headers);

        assert_eq!(filtered.get("accept").unwrap(), "text/html");
        assert_eq!(filtered.get("accept-language").unwrap(), "en-US");
        assert_eq!(filtered.get("user-agent").unwrap(), "Mozilla/5.0");
        assert_eq!(filtered.get("content-type").unwrap(), "application/json");
    }

    #[test]
    fn test_filter_response_headers_removes_security_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
        headers.insert("content-security-policy", HeaderValue::from_static("default-src 'self'"));
        headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
        headers.insert("strict-transport-security", HeaderValue::from_static("max-age=31536000"));
        headers.insert("content-type", HeaderValue::from_static("text/html"));

        let filtered = filter_response_headers(&headers);

        assert!(filtered.get("x-frame-options").is_none());
        assert!(filtered.get("content-security-policy").is_none());
        assert!(filtered.get("x-content-type-options").is_none());
        assert!(filtered.get("strict-transport-security").is_none());
        assert_eq!(filtered.get("content-type").unwrap(), "text/html");
    }

    #[test]
    fn test_filter_response_headers_adds_cors_header() {
        let headers = HeaderMap::new();
        let filtered = filter_response_headers(&headers);

        assert_eq!(filtered.get("access-control-allow-origin").unwrap(), "*");
    }

    #[test]
    fn test_filter_response_headers_forwards_content_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("content-type", HeaderValue::from_static("application/json"));
        headers.insert("cache-control", HeaderValue::from_static("no-cache"));
        headers.insert("etag", HeaderValue::from_static("\"abc123\""));

        let filtered = filter_response_headers(&headers);

        assert_eq!(filtered.get("content-type").unwrap(), "application/json");
        assert_eq!(filtered.get("cache-control").unwrap(), "no-cache");
        assert_eq!(filtered.get("etag").unwrap(), "\"abc123\"");
        assert_eq!(filtered.get("access-control-allow-origin").unwrap(), "*");
    }

    #[test]
    fn test_filter_response_headers_empty() {
        let headers = HeaderMap::new();
        let filtered = filter_response_headers(&headers);
        // Should still have CORS header
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered.get("access-control-allow-origin").unwrap(), "*");
    }

    #[test]
    fn test_blocked_request_headers_constants() {
        // Verify host is blocked (reqwest sets it from URL)
        assert!(BLOCKED_REQUEST_HEADERS.contains(&"host"));
        // Verify security headers are blocked
        assert!(BLOCKED_REQUEST_HEADERS.contains(&"x-frame-options"));
        assert!(BLOCKED_REQUEST_HEADERS.contains(&"content-security-policy"));
        assert!(BLOCKED_REQUEST_HEADERS.contains(&"x-content-type-options"));
        assert!(BLOCKED_REQUEST_HEADERS.contains(&"strict-transport-security"));
        // Verify origin, referer, cookie are NOT blocked (transparent passthrough)
        assert!(!BLOCKED_REQUEST_HEADERS.contains(&"origin"));
        assert!(!BLOCKED_REQUEST_HEADERS.contains(&"referer"));
        assert!(!BLOCKED_REQUEST_HEADERS.contains(&"cookie"));
    }

    #[test]
    fn test_blocked_response_headers_constants() {
        assert!(BLOCKED_RESPONSE_HEADERS.contains(&"x-frame-options"));
        assert!(BLOCKED_RESPONSE_HEADERS.contains(&"content-security-policy"));
        assert!(BLOCKED_RESPONSE_HEADERS.contains(&"x-content-type-options"));
        assert!(BLOCKED_RESPONSE_HEADERS.contains(&"strict-transport-security"));
    }
}
