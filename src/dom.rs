// dom.rs - DOM tree extraction from Chrome via CDP

use chromiumoxide::cdp::browser_protocol::dom::Node;
use chromiumoxide::page::Page;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomNode {
    pub node_id: i64,
    pub node_type: i64,
    pub node_name: String,
    pub node_value: String,
    pub attributes: Vec<(String, String)>,
    pub children: Vec<DomNode>,
    pub computed_style: Option<ComputedStyle>,
    pub box_model: Option<BoxModel>,
    pub scroll_top: Option<f64>,
    pub scroll_left: Option<f64>,
    pub scroll_width: Option<f64>,
    pub scroll_height: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputedStyle {
    pub display: String,
    pub position: String,
    pub width: String,
    pub height: String,
    pub top: String,
    pub left: String,
    pub right: String,
    pub bottom: String,
    pub margin_top: String,
    pub margin_right: String,
    pub margin_bottom: String,
    pub margin_left: String,
    pub padding_top: String,
    pub padding_right: String,
    pub padding_bottom: String,
    pub padding_left: String,
    pub font_size: String,
    pub font_family: String,
    pub font_weight: String,
    pub color: String,
    pub background_color: String,
    pub border_top_width: String,
    pub border_right_width: String,
    pub border_bottom_width: String,
    pub border_left_width: String,
    pub overflow: String,
    pub visibility: String,
    pub opacity: String,
    pub z_index: Option<String>,
    pub flex_direction: Option<String>,
    pub justify_content: Option<String>,
    pub align_items: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoxModel {
    pub content: [f64; 4],
    pub padding: [f64; 4],
    pub border: [f64; 4],
    pub margin: [f64; 4],
    pub width: f64,
    pub height: f64,
}

pub struct DomExtractor;

impl DomExtractor {
    pub async fn extract_dom(page: &Page) -> Result<DomNode, Box<dyn std::error::Error>> {
        // Enable DOM domain
        page.enable_dom().await?;

        // Get document root
        let doc = page.get_document().await?;

        // Recursively extract nodes
        let root = Self::extract_node(page, &doc).await?;

        Ok(root)
    }

    async fn extract_node(
        page: &Page,
        node: &Node,
    ) -> Result<DomNode, Box<dyn std::error::Error>> {
        let node_id = *node.node_id.inner();
        let node_type = node.node_type;
        let node_name = node.node_name.clone();
        let node_value = node.node_value.clone();

        // Extract attributes from flat array into key-value pairs
        let attributes = node
            .attributes
            .clone()
            .unwrap_or_default()
            .chunks(2)
            .map(|chunk| {
                if chunk.len() == 2 {
                    (chunk[0].clone(), chunk[1].clone())
                } else {
                    (String::new(), String::new())
                }
            })
            .collect();

        // Extract children recursively
        let mut children = Vec::new();
        if let Some(child_nodes) = &node.children {
            for child in child_nodes {
                let child_dom = Box::pin(Self::extract_node(page, child)).await?;
                children.push(child_dom);
            }
        }

        // Computed style - TODO: Phase 4 optimization
        let computed_style = None;

        // Box model - TODO: Phase 4 optimization
        let box_model = None;

        // Extract scroll info for root elements (HTML and BODY)
        let (scroll_top, scroll_left, scroll_width, scroll_height) =
            if node_name == "HTML" || node_name == "BODY" {
                let scroll_top = page
                    .evaluate("document.documentElement.scrollTop || document.body.scrollTop")
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()));
                let scroll_left = page
                    .evaluate("document.documentElement.scrollLeft || document.body.scrollLeft")
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()));
                let scroll_width = page
                    .evaluate("document.documentElement.scrollWidth || document.body.scrollWidth")
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()));
                let scroll_height = page
                    .evaluate(
                        "document.documentElement.scrollHeight || document.body.scrollHeight",
                    )
                    .await
                    .ok()
                    .and_then(|v| v.value().and_then(|val| val.as_f64()));
                (scroll_top, scroll_left, scroll_width, scroll_height)
            } else {
                (None, None, None, None)
            };

        Ok(DomNode {
            node_id,
            node_type,
            node_name,
            node_value,
            attributes,
            children,
            computed_style,
            box_model,
            scroll_top,
            scroll_left,
            scroll_width,
            scroll_height,
        })
    }
}
