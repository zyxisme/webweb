// browser.rs - Browser instance management using chromiumoxide

use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::page::Page;
use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct BrowserManager {
    browser: Browser,
    tabs: Arc<Mutex<HashMap<String, Page>>>,
}

impl BrowserManager {
    pub async fn new(chrome_path: Option<&str>) -> Result<Self, Box<dyn std::error::Error>> {
        let mut builder = BrowserConfig::builder()
            .disable_default_args()
            .arg("--no-sandbox")
            .arg("--disable-setuid-sandbox")
            .arg("--disable-dev-shm-usage");

        if let Some(path) = chrome_path {
            builder = builder.chrome_executable(path);
        }

        let config = builder.build()?;
        let (browser, mut handler) = Browser::launch(config).await?;

        // Spawn handler in background
        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    log::error!("Browser event error: {}", e);
                }
            }
        });

        Ok(Self {
            browser,
            tabs: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn create_tab(&self, tab_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let page = self.browser.new_page("about:blank").await?;
        self.tabs.lock().await.insert(tab_id.to_string(), page);
        Ok(())
    }

    pub async fn close_tab(&self, tab_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(page) = self.tabs.lock().await.remove(tab_id) {
            page.close().await?;
        }
        Ok(())
    }

    pub async fn get_tab(&self, tab_id: &str) -> Option<Page> {
        self.tabs.lock().await.get(tab_id).cloned()
    }

    pub async fn navigate(&self, tab_id: &str, url: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(page) = self.get_tab(tab_id).await {
            page.goto(url).await?;
        }
        Ok(())
    }

    pub async fn get_tabs(&self) -> Vec<String> {
        self.tabs.lock().await.keys().cloned().collect()
    }
}
