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
 * MCP Server Entry Point
 *
 * Supports two modes:
 * 1. stdio mode (--stdio flag) - for Claude Desktop / local use
 * 2. HTTP mode (default) - for remote deployment / claude.ai
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

const isStdioMode = process.argv.includes("--stdio");

async function main() {
  if (isStdioMode) {
    // Stdio mode: for Claude Desktop
    console.error("Starting Grafana MCP server in stdio mode...");

    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Grafana MCP server running on stdio");
  } else {
    // HTTP mode: for remote deployment using Streamable HTTP transport
    const port = parseInt(process.env.PORT || "3001", 10);

    console.error(
      `Starting Grafana MCP server in HTTP mode on port ${port}...`
    );

    const app = createMcpExpressApp({ host: "0.0.0.0" });
    app.use(cors());

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        service: "grafana-mcp-app",
        version: "1.0.0",
      });
    });

    // MCP endpoint using StreamableHTTPServerTransport
    app.all("/mcp", async (req: Request, res: Response) => {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("MCP error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });

    const httpServer = app.listen(port, (err) => {
      if (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
      }
      console.error(`\nGrafana MCP server listening on http://0.0.0.0:${port}`);
      console.error(`  Local:   http://localhost:${port}/mcp`);
      console.error(`  Network: http://192.168.50.36:${port}/mcp`);
      console.error(`  Health:  http://192.168.50.36:${port}/health\n`);
    });

    const shutdown = () => {
      console.error("\nShutting down...");
      httpServer.close(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
