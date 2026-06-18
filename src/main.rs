// main.rs - Entry point, CLI parsing, server startup

mod browser;
mod dom;
mod static_files;
mod ws;

use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Router,
};
use browser::BrowserManager;
use clap::Parser;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Parser)]
#[command(name = "webweb")]
#[command(about = "A browser tab simulation system with Rust backend")]
struct Cli {
    /// Bind address (default: 0.0.0.0:7899)
    #[arg(short, long, default_value = "0.0.0.0:7899")]
    bind: String,

    /// Chrome executable path (auto-detect if not specified)
    #[arg(long)]
    chrome_path: Option<String>,
}

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

async fn static_handler(Path(path): Path<String>) -> impl IntoResponse {
    match static_files::static_handler(&path).await {
        Ok((headers, body)) => (StatusCode::OK, headers, body).into_response(),
        Err(status) => {
            let message = status.canonical_reason().unwrap_or("Not Found");
            (status, message).into_response()
        }
    }
}

async fn health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Initialize browser manager
    let browser = Arc::new(Mutex::new(
        BrowserManager::new(cli.chrome_path.as_deref())
            .await
            .expect("Failed to start browser"),
    ));

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws::ws_handler))
        .route("/", get(|| async { static_files::static_handler("index.html").await }))
        .route("/*path", get(static_handler))
        .layer(Extension(browser));

    let listener = try_bind(&cli.bind).await.unwrap();

    println!("[INFO] WebWeb 2.0 listening on http://{}", listener.local_addr().unwrap());

    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_default_bind() {
        let cli = Cli::parse_from(["webweb"]);
        assert_eq!(cli.bind, "0.0.0.0:7899");
    }

    #[test]
    fn test_cli_custom_bind() {
        let cli = Cli::parse_from(["webweb", "--bind", "127.0.0.1:3000"]);
        assert_eq!(cli.bind, "127.0.0.1:3000");
    }

    #[test]
    fn test_cli_short_bind_flag() {
        let cli = Cli::parse_from(["webweb", "-b", "0.0.0.0:8080"]);
        assert_eq!(cli.bind, "0.0.0.0:8080");
    }

    #[tokio::test]
    async fn test_try_bind_invalid_format() {
        let result = try_bind("invalid").await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().kind(),
            std::io::ErrorKind::InvalidInput
        );
    }

    #[tokio::test]
    async fn test_try_bind_invalid_port() {
        let result = try_bind("0.0.0.0:notaport").await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().kind(),
            std::io::ErrorKind::InvalidInput
        );
    }

    #[tokio::test]
    async fn test_try_bind_success() {
        let result = try_bind("127.0.0.1:0").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_try_bind_port_auto_increment() {
        // Bind to a port, then try the same port — should succeed on next port
        let first = tokio::net::TcpListener::bind("127.0.0.1:19876").await.unwrap();
        let addr = first.local_addr().unwrap();
        let result = try_bind(&format!("127.0.0.1:{}", addr.port())).await;
        assert!(result.is_ok());
    }
}
