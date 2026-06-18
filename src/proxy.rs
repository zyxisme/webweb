// proxy.rs - Proxy logic (request forwarding, response handling)

use axum::extract::{Query, State};
use axum::http::{HeaderMap, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::Arc;
use std::time::Duration;

#[derive(Deserialize)]
pub struct ProxyParams {
    pub url: String,
}

/// Shared HTTP client state
#[derive(Clone)]
pub struct AppState {
    pub client: Arc<reqwest::Client>,
}

impl AppState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to create HTTP client");
        Self {
            client: Arc::new(client),
        }
    }
}

/// Check if a hostname resolves to a private/internal IP address
fn is_private_or_local_host(hostname: &str) -> bool {
    // Block localhost by name
    if hostname.eq_ignore_ascii_case("localhost") {
        return true;
    }

    // Try to parse as IP address
    if let Ok(ip) = hostname.parse::<IpAddr>() {
        return is_private_ip(ip);
    }

    false
}

/// Check if an IP address is in a private/internal range
fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => is_private_ipv4(ipv4),
        IpAddr::V6(ipv6) => is_private_ipv6(ipv6),
    }
}

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    // 127.0.0.0/8 - Loopback
    if ip.is_loopback() {
        return true;
    }
    // 10.0.0.0/8 - Private
    if ip.octets()[0] == 10 {
        return true;
    }
    // 172.16.0.0/12 - Private
    if ip.octets()[0] == 172 && (ip.octets()[1] >= 16 && ip.octets()[1] <= 31) {
        return true;
    }
    // 192.168.0.0/16 - Private
    if ip.octets()[0] == 192 && ip.octets()[1] == 168 {
        return true;
    }
    // 169.254.0.0/16 - Link-local
    if ip.is_link_local() {
        return true;
    }
    // 0.0.0.0 - Unspecified
    if ip.is_unspecified() {
        return true;
    }
    false
}

fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    // ::1 - Loopback
    if ip.is_loopback() {
        return true;
    }
    // fc00::/7 - Unique local addresses
    let octets = ip.octets();
    if (octets[0] & 0xfe) == 0xfc {
        return true;
    }
    // fe80::/10 - Link-local
    if ip.is_unicast_link_local() {
        return true;
    }
    // :: - Unspecified
    if ip.is_unspecified() {
        return true;
    }
    false
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

fn cors_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("access-control-allow-origin", "*".parse().unwrap());
    headers
}

pub async fn proxy_handler(
    State(state): State<AppState>,
    Query(params): Query<ProxyParams>,
    method: Method,
    headers: HeaderMap,
    body: bytes::Bytes,
) -> Response {
    // SSRF protection: validate the target URL
    let target_url = match url::Url::parse(&params.url) {
        Ok(u) => u,
        Err(_) => {
            let mut resp = (StatusCode::BAD_REQUEST, "Invalid URL").into_response();
            *resp.headers_mut() = cors_headers();
            return resp;
        }
    };

    if let Some(hostname) = target_url.host_str() {
        if is_private_or_local_host(hostname) {
            println!("[PROXY] Blocked request to private/internal host: {}", hostname);
            let mut resp = (StatusCode::FORBIDDEN, "Access to private/internal addresses is not allowed").into_response();
            *resp.headers_mut() = cors_headers();
            return resp;
        }
    } else {
        let mut resp = (StatusCode::BAD_REQUEST, "URL has no host").into_response();
        *resp.headers_mut() = cors_headers();
        return resp;
    }

    let filtered_headers = filter_request_headers(&headers);

    let mut request = state.client.request(method.clone(), &params.url);

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

            let mut resp = (StatusCode::BAD_GATEWAY, error_response.to_string()).into_response();
            *resp.headers_mut() = cors_headers();
            resp
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

    // SSRF validation tests
    #[test]
    fn test_is_private_ip_localhost_loopback() {
        assert!(is_private_ip("127.0.0.1".parse().unwrap()));
        assert!(is_private_ip("127.0.0.2".parse().unwrap()));
        assert!(is_private_ip("127.255.255.255".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ip_10_network() {
        assert!(is_private_ip("10.0.0.1".parse().unwrap()));
        assert!(is_private_ip("10.255.255.255".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ip_172_16_network() {
        assert!(is_private_ip("172.16.0.1".parse().unwrap()));
        assert!(is_private_ip("172.31.255.255".parse().unwrap()));
        // 172.15 and 172.32 should NOT be private
        assert!(!is_private_ip("172.15.0.1".parse().unwrap()));
        assert!(!is_private_ip("172.32.0.1".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ip_192_168_network() {
        assert!(is_private_ip("192.168.0.1".parse().unwrap()));
        assert!(is_private_ip("192.168.255.255".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ip_link_local() {
        assert!(is_private_ip("169.254.1.1".parse().unwrap()));
        assert!(is_private_ip("169.254.169.254".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ip_public_ips() {
        assert!(!is_private_ip("8.8.8.8".parse().unwrap()));
        assert!(!is_private_ip("1.1.1.1".parse().unwrap()));
        assert!(!is_private_ip("208.67.222.222".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ipv6_loopback() {
        assert!(is_private_ip("::1".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ipv6_unique_local() {
        assert!(is_private_ip("fc00::1".parse().unwrap()));
        assert!(is_private_ip("fd00::1".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ipv6_link_local() {
        assert!(is_private_ip("fe80::1".parse().unwrap()));
    }

    #[test]
    fn test_is_private_ipv6_public() {
        assert!(!is_private_ip("2001:4860:4860::8888".parse().unwrap()));
    }

    #[test]
    fn test_is_private_or_local_host_localhost() {
        assert!(is_private_or_local_host("localhost"));
        assert!(is_private_or_local_host("LOCALHOST"));
    }

    #[test]
    fn test_is_private_or_local_host_private_ip_literal() {
        assert!(is_private_or_local_host("127.0.0.1"));
        assert!(is_private_or_local_host("10.0.0.1"));
        assert!(is_private_or_local_host("192.168.1.1"));
        assert!(is_private_or_local_host("::1"));
    }

    #[test]
    fn test_is_private_or_local_host_public() {
        assert!(!is_private_or_local_host("example.com"));
        assert!(!is_private_or_local_host("google.com"));
    }

    #[test]
    fn test_cors_headers() {
        let headers = cors_headers();
        assert_eq!(headers.get("access-control-allow-origin").unwrap(), "*");
    }
}
