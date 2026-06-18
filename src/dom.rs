// dom.rs - DOM tree extraction from Chrome via JavaScript evaluation

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
    /// Extract the full DOM tree using JavaScript evaluation.
    /// This gets computed styles and box models in a single call,
    /// which is much faster than per-node CDP calls.
    pub async fn extract_dom(page: &Page) -> Result<DomNode, Box<dyn std::error::Error>> {
        let js_code = r#"
            (function() {
                let nextId = 0;
                function getAttrs(el) {
                    const attrs = [];
                    for (let i = 0; i < el.attributes.length; i++) {
                        const a = el.attributes[i];
                        attrs.push([a.name, a.value]);
                    }
                    return attrs;
                }
                function getCS(el) {
                    const s = getComputedStyle(el);
                    function g(p) { return s.getPropertyValue(p) || ''; }
                    return {
                        display: s.display || '', position: s.position || '',
                        width: s.width || '', height: s.height || '',
                        top: s.top || '', left: s.left || '',
                        right: s.right || '', bottom: s.bottom || '',
                        margin_top: s.marginTop || '', margin_right: s.marginRight || '',
                        margin_bottom: s.marginBottom || '', margin_left: s.marginLeft || '',
                        padding_top: s.paddingTop || '', padding_right: s.paddingRight || '',
                        padding_bottom: s.paddingBottom || '', padding_left: s.paddingLeft || '',
                        font_size: s.fontSize || '', font_family: s.fontFamily || '',
                        font_weight: s.fontWeight || '', color: s.color || '',
                        background_color: s.backgroundColor || '',
                        border_top_width: s.borderTopWidth || '',
                        border_right_width: s.borderRightWidth || '',
                        border_bottom_width: s.borderBottomWidth || '',
                        border_left_width: s.borderLeftWidth || '',
                        overflow: s.overflow || '', visibility: s.visibility || '',
                        opacity: s.opacity || '',
                        z_index: s.zIndex || null,
                        flex_direction: s.flexDirection || null,
                        justify_content: s.justifyContent || null,
                        align_items: s.alignItems || null
                    };
                }
                const sx = window.scrollX || 0, sy = window.scrollY || 0;
                function walk(node) {
                    if (node.nodeType === 3) {
                        const text = node.nodeValue;
                        if (!text || !text.trim()) return null;
                        const range = document.createRange();
                        range.selectNodeContents(node);
                        const rects = range.getClientRects();
                        let x = 0, y = 0, w = 0, h = 0;
                        if (rects.length > 0) {
                            const r = rects[0];
                            x = r.left + sx; y = r.top + sy; w = r.width; h = r.height;
                        }
                        return {
                            node_id: nextId++, node_type: 3, node_name: '#text',
                            node_value: text, attributes: [], children: [],
                            computed_style: null,
                            box_model: { content: [x, y, w, h], padding: [0,0,0,0], border: [0,0,0,0], margin: [0,0,0,0], width: w, height: h },
                            scroll_top: null, scroll_left: null, scroll_width: null, scroll_height: null
                        };
                    }
                    if (node.nodeType !== 1) return null;
                    const el = node;
                    const cs = getCS(el);
                    if (cs.display === 'none') return null;
                    const r = el.getBoundingClientRect();
                    const children = [];
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const c = walk(node.childNodes[i]);
                        if (c) children.push(c);
                    }
                    const st = el.scrollTop || 0, sl = el.scrollLeft || 0;
                    const sw = el.scrollWidth || 0, sh = el.scrollHeight || 0;
                    return {
                        node_id: nextId++, node_type: 1, node_name: el.tagName,
                        node_value: '', attributes: getAttrs(el), children: children,
                        computed_style: cs,
                        box_model: { content: [r.left + sx, r.top + sy, r.width, r.height], padding: [0,0,0,0], border: [0,0,0,0], margin: [0,0,0,0], width: r.width, height: r.height },
                        scroll_top: st || null, scroll_left: sl || null,
                        scroll_width: sw || null, scroll_height: sh || null
                    };
                }
                return walk(document.documentElement);
            })()
        "#;

        let result = page.evaluate(js_code).await?;
        let value = result.value().ok_or("No value returned from JS evaluation")?;
        let dom: DomNode = serde_json::from_value(value.clone())?;
        Ok(dom)
    }
}
