// static_files.rs - Static file serving with rust-embed

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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_static_handler_index_html() {
        let result = static_handler("index.html").await;
        assert!(result.is_ok());

        let (headers, body) = result.unwrap();
        assert!(!body.is_empty());
        assert_eq!(
            headers.get("content-type").unwrap().to_str().unwrap(),
            "text/html"
        );
    }

    #[tokio::test]
    async fn test_static_handler_with_leading_slash() {
        let result = static_handler("/index.html").await;
        assert!(result.is_ok());

        let (_, body) = result.unwrap();
        assert!(!body.is_empty());
    }

    #[tokio::test]
    async fn test_static_handler_sw_js() {
        let result = static_handler("sw.js").await;
        assert!(result.is_ok());

        let (headers, body) = result.unwrap();
        assert!(!body.is_empty());
        let content_type = headers.get("content-type").unwrap().to_str().unwrap();
        assert!(
            content_type.contains("javascript"),
            "Expected javascript content-type, got: {}",
            content_type
        );
    }

    #[tokio::test]
    async fn test_static_handler_not_found() {
        let result = static_handler("nonexistent.txt").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_static_handler_not_found_deep_path() {
        let result = static_handler("some/deep/path/file.txt").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_static_handler_body_contains_html() {
        let result = static_handler("index.html").await;
        let (_, body) = result.unwrap();
        let content = String::from_utf8(body).unwrap();
        assert!(content.contains("<!DOCTYPE html>") || content.contains("<html"));
    }
}
