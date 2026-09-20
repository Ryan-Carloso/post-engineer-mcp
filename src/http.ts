import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createPostEngineerMcpServer } from './index.js';
import { PostEngineerClient } from './client.js';
import { docsHtml, docsMarkdown, healthMarkdown } from './http-docs.js';

const MCP_PATH = '/';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured for HTTP mode.`);
  }
  return value;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function writeText(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  response.writeHead(statusCode, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Cache-Control': 'no-store',
  });
  if (response.req?.method !== 'HEAD') response.end(body);
  else response.end();
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id');
}

function getPostEngineerApiKey(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return undefined;

  const apiKey = authorization.slice('Bearer '.length).trim();
  return apiKey.length > 0 ? apiKey : undefined;
}

async function handleMcpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  postEngineerApiKey: string,
): Promise<void> {
  const server: McpServer = createPostEngineerMcpServer(
    new PostEngineerClient({ apiKey: postEngineerApiKey }),
  );
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  response.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error: unknown) {
    console.error('[mcp/http] request failed', error);
    if (!response.headersSent) {
      writeJson(response, 500, {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error.' },
        id: null,
      });
    }
  }
}

export function createPostEngineerHttpServer(): Server {
  return createServer((request, response) => {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (pathname === '/health' || pathname === '/health.md') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        writeJson(response, 405, { error: 'Only GET and HEAD are supported.' });
        return;
      }
      if (pathname === '/health.md') {
        writeText(response, 200, 'text/markdown', healthMarkdown);
        return;
      }
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (pathname === '/docs' || pathname === '/docs.md') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        writeJson(response, 405, { error: 'Only GET and HEAD are supported.' });
        return;
      }
      if (pathname === '/docs.md') {
        writeText(response, 200, 'text/markdown', docsMarkdown);
        return;
      }
      writeText(response, 200, 'text/html', docsHtml);
      return;
    }

    if (pathname !== MCP_PATH) {
      writeJson(response, 404, { error: 'Not found.' });
      return;
    }

    const postEngineerApiKey = getPostEngineerApiKey(request);
    if (!postEngineerApiKey) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      writeJson(response, 401, { error: 'Authentication required.' });
      return;
    }

    if (request.method !== 'POST') {
      writeJson(response, 405, { error: 'Only POST is supported at /.' });
      return;
    }

    void handleMcpRequest(request, response, postEngineerApiKey);
  });
}

export async function startHttpServer(): Promise<Server> {
  const portValue = requiredEnvironmentVariable('MCP_PORT');
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MCP_PORT must be an integer between 1 and 65535.');
  }

  const httpServer = createPostEngineerHttpServer();

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '0.0.0.0', () => resolve());
  });

  console.error(`[mcp/http] listening on port ${port}; endpoint path is ${MCP_PATH}`);
  return httpServer;
}
