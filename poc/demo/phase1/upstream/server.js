#!/usr/bin/env node
'use strict';

const http = require('http');
const { URL } = require('url');

const HOST = process.env.UPSTREAM_HOST || '0.0.0.0';
const PORT = Number(process.env.UPSTREAM_PORT || 3010);

// A tiny “good enough for demo” PDF-ish payload.
// (We don’t depend on a real file existing in the container.)
function demoPdfBytes() {
  // Minimal PDF structure; most clients will accept it for demo purposes.
  const s =
    '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
    '4 0 obj\n<< /Length 58 >>\nstream\nBT\n/F1 24 Tf\n72 720 Td\n(Demo PDF served by PoC upstream) Tj\nET\nendstream\nendobj\n' +
    'xref\n0 5\n0000000000 65535 f \n' +
    '0000000010 00000 n \n' +
    '0000000062 00000 n \n' +
    '0000000117 00000 n \n' +
    '0000000190 00000 n \n' +
    'trailer\n<< /Size 5 /Root 1 0 R >>\n' +
    'startxref\n280\n%%EOF\n';
  return Buffer.from(s, 'utf8');
}

function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendBytes(res, status, bytes, headers = {}) {
  res.writeHead(status, {
    'content-length': String(bytes.length),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(bytes);
}

const server = http.createServer((req, res) => {
  const start = Date.now();

  // Never let an exception become a dropped socket / opaque 500 without logging.
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = u.pathname || '/';
    const method = String(req.method || 'GET').toUpperCase();

    // Simple request log
    console.log(`[upstream] ${method} ${path}`);

    // Health
    if (method === 'GET' && path === '/healthz') {
      return sendJson(res, 200, { ok: true, service: 'poc-upstream', port: PORT });
    }

    // We only need GET for Phase 1 demo.
    if (method !== 'GET') {
      return sendJson(res, 405, { ok: false, error: 'method_not_allowed', method });
    }

    // Serve demo PDF for /paid/demo.pdf and anything under /paid/
    if (path === '/paid/demo.pdf' || path.startsWith('/paid/')) {
      const bytes = demoPdfBytes();
      return sendBytes(res, 200, bytes, {
        'content-type': 'application/pdf',
        'x-upstream-demo': 'true',
      });
    }

    // Everything else
    return sendJson(res, 404, { ok: false, error: 'not_found', path });
  } catch (err) {
    console.error('[upstream] ERROR handling request:', err);
    // Return a safe JSON 500 (but with a real body) so debugging is easy.
    return sendJson(res, 500, { ok: false, error: 'internal_error' });
  } finally {
    const ms = Date.now() - start;
    // response status is not available reliably here without wrapping res.end; keep it simple.
    console.log(`[upstream] done in ${ms}ms`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[upstream] listening on http://${HOST}:${PORT}`);
});
