#!/usr/bin/env node

/*
 * Copyright 2026 Grafana MCP App Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * stdio-to-HTTP Bridge for MCP Servers
 *
 * This bridge allows HTTP-based MCP clients (like basic-host) to connect
 * to MCP servers that use stdio transport.
 *
 * How it works:
 * 1. Spawns the MCP server as a child process with stdio transport
 * 2. Exposes an HTTP endpoint that proxies MCP protocol via SSE
 * 3. basic-host connects via HTTP, messages are forwarded to/from stdio
 */

import { spawn } from 'child_process';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.BRIDGE_PORT || '3002', 10);

// Path to the MCP server
const SERVER_PATH = join(__dirname, 'dist/src/server/main.js');
const SERVER_ARGS = ['--stdio'];

// Environment variables for the server
const SERVER_ENV = {
  ...process.env,
  GRAFANA_BASE_URL: process.env.GRAFANA_BASE_URL || 'http://localhost:3000',
  GRAFANA_SERVICE_TOKEN: process.env.GRAFANA_SERVICE_TOKEN,
  GRAFANA_ORG_ID: process.env.GRAFANA_ORG_ID || '1',
};

console.error('Starting stdio-to-HTTP bridge...');
console.error(`Server: ${SERVER_PATH}`);
console.error(`Port: ${PORT}`);

const app = express();
app.use(cors());
app.use(express.json());

// Store active SSE connections
const connections = new Map();
let connectionIdCounter = 0;

// Spawn MCP server in stdio mode
function spawnServer(connectionId) {
  console.error(`[${connectionId}] Spawning MCP server...`);

  const child = spawn('node', [SERVER_PATH, ...SERVER_ARGS], {
    env: SERVER_ENV,
    stdio: ['pipe', 'pipe', 'inherit'], // stdin, stdout, stderr
  });

  const connection = {
    id: connectionId,
    process: child,
    responseQueue: [],
    sseRes: null,
  };

  // Handle server output (JSON-RPC responses)
  let buffer = '';
  child.stdout.on('data', (data) => {
    buffer += data.toString();

    // Split by newlines (JSON-RPC messages are line-delimited)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        console.error(`[${connectionId}] Server → Client:`, JSON.stringify(message).substring(0, 200));

        // Send via SSE if connected
        if (connection.sseRes) {
          connection.sseRes.write(`data: ${JSON.stringify(message)}\n\n`);
        } else {
          connection.responseQueue.push(message);
        }
      } catch (error) {
        console.error(`[${connectionId}] Failed to parse server output:`, line, error);
      }
    }
  });

  child.on('exit', (code) => {
    console.error(`[${connectionId}] Server process exited with code ${code}`);
    if (connection.sseRes) {
      connection.sseRes.end();
    }
    connections.delete(connectionId);
  });

  child.on('error', (error) => {
    console.error(`[${connectionId}] Server process error:`, error);
  });

  connections.set(connectionId, connection);
  return connection;
}

// SSE endpoint - establishes connection
app.get('/sse', (req, res) => {
  const connectionId = `conn_${++connectionIdCounter}`;
  console.error(`[${connectionId}] New SSE connection from ${req.ip}`);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  // Spawn server for this connection
  const connection = spawnServer(connectionId);
  connection.sseRes = res;

  // Send any queued responses
  for (const message of connection.responseQueue) {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }
  connection.responseQueue = [];

  // Send initial endpoint message (MCP SSE protocol)
  res.write(`event: endpoint\ndata: /message?connectionId=${connectionId}\n\n`);

  // Clean up on disconnect
  req.on('close', () => {
    console.error(`[${connectionId}] Client disconnected`);
    if (connection.process && !connection.process.killed) {
      connection.process.kill();
    }
    connections.delete(connectionId);
  });
});

// Message endpoint - receives client messages
app.post('/message', (req, res) => {
  const connectionId = req.query.connectionId;

  if (!connectionId) {
    res.status(400).json({ error: 'Missing connectionId parameter' });
    return;
  }

  const connection = connections.get(connectionId);
  if (!connection) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }

  const message = req.body;
  console.error(`[${connectionId}] Client → Server:`, JSON.stringify(message).substring(0, 200));

  // Send to server stdin
  connection.process.stdin.write(JSON.stringify(message) + '\n');

  // Respond immediately (SSE handles responses)
  res.status(202).end();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'stdio-bridge',
    activeConnections: connections.size,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.error(`\n✅ stdio-to-HTTP bridge running on http://0.0.0.0:${PORT}`);
  console.error(`   Local: http://localhost:${PORT}/sse`);
  console.error(`   Network: http://192.168.50.36:${PORT}/sse`);
  console.error(`   Health check: http://192.168.50.36:${PORT}/health\n`);
});
