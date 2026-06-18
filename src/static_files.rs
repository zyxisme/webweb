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
