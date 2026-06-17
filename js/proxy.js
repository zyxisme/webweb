// js/proxy.js
const ProxyManager = {
  // CORS proxy URL - can be changed if needed
  corsProxy: 'https://corsproxy.io/?',

  // Fetch a page through the CORS proxy
  async fetchPage(url) {
    const proxyUrl = this.corsProxy + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  },

  // Resolve a URL relative to a base URL
  resolveUrl(url, baseUrl) {
    try {
      // Skip special URLs
      if (!url || url.startsWith('data:') || url.startsWith('javascript:') ||
          url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('about:')) {
        return null;
      }
      return new URL(url, baseUrl).href;
    } catch (e) {
      return null;
    }
  },

  // Rewrite HTML to go through the proxy
  rewriteHtml(html, baseUrl) {
    const proxyPrefix = this.corsProxy;

    // Add base tag for relative URLs (more robust detection)
    if (!html.includes('<base')) {
      if (html.includes('<head>')) {
        html = html.replace(/<head>/i, `<head><base href="${baseUrl}">`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace(/<HEAD>/i, `<HEAD><base href="${baseUrl}">`);
      } else if (html.includes('<html>')) {
        html = html.replace(/<html>/i, `<html><head><base href="${baseUrl}"></head>`);
      } else if (html.includes('<HTML>')) {
        html = html.replace(/<HTML>/i, `<HTML><head><base href="${baseUrl}"></head>`);
      } else {
        html = `<head><base href="${baseUrl}"></head>` + html;
      }
    }

    // Rewrite src, href, action attributes
    html = html.replace(/(src|href|action)=["']([^"']*?)["']/gi, (match, attr, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `${attr}="${proxyPrefix}${encodeURIComponent(absoluteUrl)}"`;
      }
      return match;
    });

    // Rewrite srcset attribute (responsive images)
    html = html.replace(/srcset=["']([^"']*?)["']/gi, (match, srcset) => {
      const rewrittenSrcset = srcset.split(',').map(entry => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length >= 1) {
          const url = parts[0];
          const absoluteUrl = this.resolveUrl(url, baseUrl);
          if (absoluteUrl) {
            parts[0] = `${proxyPrefix}${encodeURIComponent(absoluteUrl)}`;
            return parts.join(' ');
          }
        }
        return entry;
      }).join(', ');
      return `srcset="${rewrittenSrcset}"`;
    });

    // Rewrite poster attribute (video poster)
    html = html.replace(/poster=["']([^"']*?)["']/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `poster="${proxyPrefix}${encodeURIComponent(absoluteUrl)}"`;
      }
      return match;
    });

    // Rewrite @import in CSS (handle multiple formats) - MUST be before CSS url() rewrite
    html = html.replace(/@import\s+url\(["']?([^"')]+?)["']?\)/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `@import url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });
    html = html.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `@import url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });

    // Rewrite CSS url() (excluding @import which was already handled)
    html = html.replace(/(?<!@import\s)url\(["']?([^"')]*?)["']?\)/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });

    // Inject navigation tracking and API interception script
    const trackingScript = `
<script>
(function() {
  const proxyPrefix = '${proxyPrefix}';
  const baseUrl = '${baseUrl}';

  function getOriginalUrl(url) {
    if (url.startsWith(proxyPrefix)) {
      return decodeURIComponent(url.substring(proxyPrefix.length));
    }
    return url;
  }

  function resolveUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return url;
    }
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  function proxyUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return url;
    }
    const absoluteUrl = resolveUrl(url);
    if (absoluteUrl) {
      return proxyPrefix + encodeURIComponent(absoluteUrl);
    }
    return url;
  }

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      const originalUrl = getOriginalUrl(link.href);
      window.parent.postMessage({
        type: 'webweb-navigate',
        url: originalUrl
      }, '*');
    }
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action) {
      e.preventDefault();
      const formData = new FormData(form);
      const url = new URL(getOriginalUrl(form.action));
      formData.forEach((value, key) => url.searchParams.append(key, value));
      window.parent.postMessage({
        type: 'webweb-navigate',
        url: url.href
      }, '*');
    }
  }, true);

  // ===== JavaScript API Interception =====

  // 1. Intercept fetch API
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    let url = input;
    if (typeof url === 'string') {
      url = proxyUrl(url);
    } else if (url instanceof Request) {
      url = new Request(proxyUrl(url.url), url);
    }
    return originalFetch.call(this, url, init);
  };

  // 2. Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    return originalXHROpen.call(this, method, proxyUrl(url), async, user, password);
  };

  // 3. Intercept Image constructor
  const OriginalImage = window.Image;
  window.Image = function(width, height) {
    const img = new OriginalImage(width, height);
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(img, 'src', {
      get: function() {
        return originalSrcDescriptor.get.call(this);
      },
      set: function(value) {
        originalSrcDescriptor.set.call(this, proxyUrl(value));
      }
    });
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  // 4. Intercept document.createElement for script, link, img
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    const element = originalCreateElement(tagName, options);
    const lowerTagName = tagName.toLowerCase();

    if (['script', 'link', 'img', 'video', 'audio', 'source', 'iframe'].includes(lowerTagName)) {
      const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
        lowerTagName === 'link' ? HTMLLinkElement.prototype :
        lowerTagName === 'script' ? HTMLScriptElement.prototype :
        HTMLMediaElement.prototype,
        lowerTagName === 'link' ? 'href' : 'src'
      );

      if (originalSrcDescriptor) {
        Object.defineProperty(element, lowerTagName === 'link' ? 'href' : 'src', {
          get: function() {
            return originalSrcDescriptor.get.call(this);
          },
          set: function(value) {
            originalSrcDescriptor.set.call(this, proxyUrl(value));
          }
        });
      }
    }

    return element;
  };

  // 5. Intercept dynamic style changes
  const originalStyleDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
  Object.defineProperty(HTMLElement.prototype, 'style', {
    get: function() {
      return originalStyleDescriptor.get.call(this);
    },
    set: function(value) {
      if (typeof value === 'string' && value.includes('url(')) {
        value = value.replace(/url\\(["']?([^"')]*?)["']?/gi, function(match, url) {
          return 'url("' + proxyUrl(url);
        });
      }
      originalStyleDescriptor.set.call(this, value);
    }
  });

  // 6. Intercept CSSStyleSheet.insertRule
  if (window.CSSStyleSheet && CSSStyleSheet.prototype.insertRule) {
    const originalInsertRule = CSSStyleSheet.prototype.insertRule;
    CSSStyleSheet.prototype.insertRule = function(rule, index) {
      if (rule.includes('url(')) {
        rule = rule.replace(/url\\(["']?([^"')]*?)["']?/gi, function(match, url) {
          return 'url("' + proxyUrl(url);
        });
      }
      return originalInsertRule.call(this, rule, index);
    };
  }

  console.log('[WebWeb] API interception initialized for:', baseUrl);
})();
</script>
`;

    // Inject before </head> or at the start
    if (html.includes('</head>')) {
      html = html.replace('</head>', trackingScript + '</head>');
    } else {
      html = trackingScript + html;
    }

    return html;
  },

  // Extract title from HTML
  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() : null;
  },

  // Load a page into an iframe
  async loadPage(iframe, url) {
    try {
      const html = await this.fetchPage(url);
      const title = this.extractTitle(html);
      const rewrittenHtml = this.rewriteHtml(html, url);
      iframe.srcdoc = rewrittenHtml;
      return { success: true, title };
    } catch (error) {
      console.error('Failed to load page:', error);
      iframe.srcdoc = `
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>加载失败</h1>
            <p style="color: #666;">${error.message}</p>
            <p style="color: #999;">URL: ${url}</p>
          </body>
        </html>
      `;
      return { success: false, error: error.message };
    }
  }
};
