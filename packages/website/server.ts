/**
 * YASH Website Development Server
 * 
 * A simple Bun server to serve the web application
 * with live reload capabilities.
 */

const PORT = 3000;

// MIME types
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  return mimeTypes[ext] || 'application/octet-stream';
}

const defaultHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const server = Bun.serve({
  port: PORT,
  
  async fetch(request) {
    
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    // Default to index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Try to serve from app/ directory first
    let filePath = `./app${pathname}`;
    let file = Bun.file(filePath);
    
    if (await file.exists()) {
      console.log(`Serving ${filePath}`);
      return new Response(file, {
        headers: {
          ...defaultHeaders,
          'Content-Type': getMimeType(pathname),
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    // Try to serve from dist/ directory (built JS)
    if (pathname.startsWith('/dist/')) {
      filePath = `.${pathname}`;
      file = Bun.file(filePath);
      if (await file.exists()) {
        console.log(`Serving ${filePath}`);
        return new Response(file, {
          headers: {
            ...defaultHeaders,
            'Content-Type': getMimeType(pathname),
            'Cache-Control': 'no-cache',
          },
        });
      }
    }
    
    // Fallback: serve index.html for SPA routing
    file = Bun.file('./app/index.html');
    if (await file.exists()) {
      console.log(`Fallback to index.html for ${pathname}`);
      return new Response(file, {
        headers: {
          ...defaultHeaders,
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    // 404
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`
🐚 YASH Website Server

   Local:   http://localhost:${PORT}
   
   Press Ctrl+C to stop
`);
