// server.js - Local CORS proxy server for WebWeb Browser
// Usage: node server.js [port]
// Default port: 8088

const http = require('http');
const https = require('https');

const PORT = process.argv[2] || 8088;

// CORS headers to add to all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400'
};

// Fetch URL content
function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'WebWeb-Browser/1.0',
        'Accept': '*/*'
      },
      timeout: 10000
    };

    const req = client.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).href;
        fetchUrl(redirectUrl).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Parse request URL using WHATWG URL API
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const parsedReqUrl = {
    pathname: reqUrl.pathname,
    query: Object.fromEntries(reqUrl.searchParams)
  };

  // Health check endpoint
  if (parsedReqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Proxy endpoint: /?url=ENCODED_URL or /proxy/ENCODED_URL
  let targetUrl = null;

  if (parsedReqUrl.query.url) {
    // Format: http://localhost:8080/?url=https%3A%2F%2Fexample.com
    targetUrl = parsedReqUrl.query.url;
  } else if (parsedReqUrl.pathname.startsWith('/proxy/')) {
    // Format: http://localhost:8080/proxy/https://example.com
    targetUrl = decodeURIComponent(parsedReqUrl.pathname.slice(7));
  } else if (parsedReqUrl.pathname === '/' && !parsedReqUrl.query.url) {
    // Root without URL - show usage
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>WebWeb CORS Proxy</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>WebWeb CORS Proxy Server</h1>
        <p>代理服务器运行正常 ✓</p>
        <p>使用方法: <code>http://localhost:${PORT}/?url=ENCODED_URL</code></p>
        <p>或: <code>http://localhost:${PORT}/proxy/URL</code></p>
      </body>
      </html>
    `);
    return;
  }

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  // Validate URL
  try {
    new URL(targetUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  // Fetch target URL
  try {
    console.log(`[Proxy] Fetching: ${targetUrl}`);
    const result = await fetchUrl(targetUrl);

    // Forward response with CORS headers
    const responseHeaders = {
      ...CORS_HEADERS,
      'Content-Type': result.headers['content-type'] || 'text/plain',
      'X-Proxy-Status': 'success'
    };

    res.writeHead(result.status, responseHeaders);
    res.end(result.body);
  } catch (error) {
    console.error(`[Proxy] Error fetching ${targetUrl}:`, error.message);
    res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({
      error: 'Failed to fetch URL',
      message: error.message,
      url: targetUrl
    }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           WebWeb CORS Proxy Server Started                ║
╠═══════════════════════════════════════════════════════════╣
║  Address: http://localhost:${PORT}                        ║
║                                                           ║
║  代理服务器已启动，WebWeb 会自动检测并使用                ║
║                                                           ║
║  按 Ctrl+C 停止服务器                                     ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Proxy] Shutting down...');
  server.close(() => {
    console.log('[Proxy] Server stopped');
    process.exit(0);
  });
});
