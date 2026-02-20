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
 * MCP Server - Tool and Resource Registration
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GrafanaClient } from "./grafana-client.js";
import { buildEmbedUrl } from "./embed-url-builder.js";
import {
  SearchDashboardsInput,
  GetDashboardPanelsInput,
  RenderPanelInput,
  type RenderPanelResult,
  type GrafanaVariable,
  type GrafanaPanel,
  type VariableDef,
  GrafanaApiError,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment
const config = {
  grafanaBaseUrl: process.env.GRAFANA_BASE_URL,
  grafanaToken: process.env.GRAFANA_SERVICE_TOKEN,
  grafanaOrgId: parseInt(process.env.GRAFANA_ORG_ID || "1", 10),
  defaultTheme: (process.env.GRAFANA_DEFAULT_THEME || "dark") as
    | "light"
    | "dark",
};

// Validate configuration
if (!config.grafanaBaseUrl) {
  throw new Error("GRAFANA_BASE_URL environment variable is required");
}
if (!config.grafanaToken) {
  throw new Error("GRAFANA_SERVICE_TOKEN environment variable is required");
}

// Initialize Grafana client
const client = new GrafanaClient({
  baseUrl: config.grafanaBaseUrl,
  token: config.grafanaToken,
  orgId: config.grafanaOrgId,
});

/**
 * Extract variables from dashboard JSON and transform to VariableDef format
 */
function extractVariables(
  dashboard: any,
  overrides: Record<string, string> = {}
): VariableDef[] {
  const variables: GrafanaVariable[] = dashboard.dashboard?.templating?.list || [];

  return variables
    .filter((v) => v.hide !== 2) // Skip completely hidden variables
    .filter((v) =>
      ["query", "custom", "interval"].includes(v.type)
    ) // Skip constant and datasource types
    .map((v) => {
      // Get current value (prefer override, fallback to dashboard default)
      const currentValue =
        overrides[v.name] ||
        (Array.isArray(v.current.value)
          ? v.current.value[0]
          : String(v.current.value));

      return {
        name: v.name,
        label: v.label || v.name,
        type: v.type as "query" | "custom" | "interval",
        current_value: currentValue,
        options:
          v.options?.map((opt) => ({
            text: opt.text,
            value: String(opt.value),
          })) || [],
        multi: v.multi || false,
        include_all: v.includeAll || false,
      };
    });
}

/**
 * Find a panel by ID in the dashboard (handles nested panels in rows)
 */
function findPanel(
  dashboard: any,
  panelId: number
): GrafanaPanel | undefined {
  const panels: GrafanaPanel[] = dashboard.dashboard?.panels || [];

  for (const panel of panels) {
    if (panel.id === panelId) {
      return panel;
    }
    // Check nested panels (for row-type panels)
    if (panel.panels) {
      for (const nestedPanel of panel.panels) {
        if (nestedPanel.id === panelId) {
          return nestedPanel;
        }
      }
    }
  }

  return undefined;
}

/**
 * Create and configure the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: "grafana-mcp-app",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  const resourceUri = "ui://grafana-panel/app.html";
  const grafanaBaseUrl = process.env.GRAFANA_BASE_URL || "http://localhost:3000";

  // Register resource handlers with CSP metadata
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: resourceUri,
          name: "Grafana Panel Viewer",
          description:
            "Interactive Grafana panel embed with time range and variable controls",
          mimeType: RESOURCE_MIME_TYPE,
          _meta: {
            ui: {
              csp: {
                frameDomains: [grafanaBaseUrl],
                connectDomains: [grafanaBaseUrl],
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== resourceUri) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }

    try {
      // Path to the built UI file (relative to compiled server location)
      // Server is compiled to dist/src/server/, UI is built to dist/src/ui/
      const htmlPath = join(__dirname, "../ui/grafana-panel.html");
      const contents = readFileSync(htmlPath, "utf-8");

      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: contents,
            _meta: {
              ui: {
                csp: {
                  frameDomains: [grafanaBaseUrl],
                  connectDomains: [grafanaBaseUrl],
                },
              },
            },
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to load MCP App UI resource: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Tool 1: search_dashboards
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_dashboards",
          description:
            "Search for dashboards in Grafana by name or tag. " +
            "Returns a list of matching dashboards with their UIDs, titles, and tags. " +
            "Use this before render_panel if you need to find the right dashboard UID.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search term matched against dashboard titles",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Filter to dashboards with all specified tags",
              },
              limit: {
                type: "number",
                description: "Maximum results (1-50, default 10)",
                default: 10,
              },
            },
          },
        },
        {
          name: "get_dashboard_panels",
          description:
            "Get all panels and variables from a Grafana dashboard. " +
            "Returns panel IDs, titles, types, and the list of template variables " +
            "(with their available options) defined on the dashboard. " +
            "Use this to identify the correct panel_id before calling render_panel.",
          inputSchema: {
            type: "object",
            properties: {
              dashboard_uid: {
                type: "string",
                description: "Dashboard UID from search_dashboards",
              },
            },
            required: ["dashboard_uid"],
          },
        },
        {
          name: "render_panel",
          description:
            "Render an interactive Grafana panel inline in the conversation. " +
            "The panel will appear with time range controls and variable dropdowns. " +
            "Requires dashboard_uid (from search_dashboards) and panel_id (from get_dashboard_panels). " +
            "Defaults: from=now-1h, to=now.",
          inputSchema: {
            type: "object",
            properties: {
              dashboard_uid: {
                type: "string",
                description: "Dashboard UID",
              },
              panel_id: {
                type: "number",
                description: "Panel ID",
              },
              from: {
                type: "string",
                description:
                  "Start of time range (Grafana relative or epoch ms)",
                default: "now-1h",
              },
              to: {
                type: "string",
                description: "End of time range",
                default: "now",
              },
              variables: {
                type: "object",
                description: "Variable overrides (name: value)",
                additionalProperties: { type: "string" },
              },
              refresh: {
                type: "string",
                description: "Auto-refresh interval (e.g. 10s, 1m, 5m)",
              },
            },
            required: ["dashboard_uid", "panel_id"],
          },
          _meta: {
            ui: {
              resourceUri: resourceUri,
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "search_dashboards": {
          const input = SearchDashboardsInput.parse(request.params.arguments);
          const results = await client.searchDashboards(input);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  results.map((d) => ({
                    uid: d.uid,
                    title: d.title,
                    tags: d.tags,
                    url: `${config.grafanaBaseUrl}/d/${d.uid}`,
                  })),
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_dashboard_panels": {
          const input = GetDashboardPanelsInput.parse(
            request.params.arguments
          );
          const dashboard = await client.getDashboard(input.dashboard_uid);

          // Extract panels (including nested panels in rows)
          const allPanels: any[] = [];
          for (const panel of dashboard.dashboard.panels || []) {
            if (panel.type === "row" && panel.panels) {
              // Add nested panels from rows
              allPanels.push(...panel.panels);
            } else {
              allPanels.push(panel);
            }
          }

          const variables = extractVariables(dashboard);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    title: dashboard.dashboard.title,
                    panels: allPanels.map((p) => ({
                      id: p.id,
                      title: p.title,
                      type: p.type,
                      description: p.description || undefined,
                    })),
                    variables: variables.map((v) => ({
                      name: v.name,
                      label: v.label,
                      type: v.type,
                      options: v.options.map((o) => o.text),
                      current: v.current_value,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "render_panel": {
          const input = RenderPanelInput.parse(request.params.arguments);
          const dashboard = await client.getDashboard(input.dashboard_uid);

          // Find the panel
          const panel = findPanel(dashboard, input.panel_id);
          if (!panel) {
            // List available panels to help user
            const allPanels: any[] = [];
            for (const p of dashboard.dashboard.panels || []) {
              if (p.type === "row" && p.panels) {
                allPanels.push(...p.panels);
              } else {
                allPanels.push(p);
              }
            }

            throw new Error(
              `Panel ${input.panel_id} not found in dashboard "${dashboard.dashboard.title}". ` +
                `Available panels: ${allPanels.map((p) => `${p.id} (${p.title})`).join(", ")}`
            );
          }

          // Extract variables
          const variables = extractVariables(dashboard, input.variables);

          // Build embed URL
          const embedUrl = buildEmbedUrl({
            baseUrl: config.grafanaBaseUrl!,
            uid: input.dashboard_uid,
            panelId: input.panel_id,
            orgId: config.grafanaOrgId,
            from: input.from,
            to: input.to,
            variables: input.variables,
            theme: config.defaultTheme,
            slug: dashboard.meta.slug,
            refresh: input.refresh,
          });

          // Attempt image renderer fallback (non-blocking, best-effort)
          let fallbackB64: string | undefined;
          try {
            const imageBuffer = await client.renderPanelImage({
              uid: input.dashboard_uid,
              slug: dashboard.meta.slug,
              panelId: input.panel_id,
              from: input.from,
              to: input.to,
              variables: input.variables,
            });

            if (imageBuffer) {
              fallbackB64 = Buffer.from(imageBuffer).toString("base64");
            }
          } catch (error) {
            // Ignore errors - fallback is optional
          }

          const result: RenderPanelResult = {
            grafana_base_url: config.grafanaBaseUrl!,
            dashboard_uid: input.dashboard_uid,
            dashboard_title: dashboard.dashboard.title,
            panel_id: input.panel_id,
            panel_title: panel.title,
            panel_type: panel.type,
            panel_description: panel.description,
            embed_url: embedUrl,
            org_id: config.grafanaOrgId,
            from: input.from,
            to: input.to,
            variables,
            fallback_image_b64: fallbackB64,
          };

          // Return tool result with MCP App metadata
          return {
            content: [
              {
                type: "text",
                text:
                  `Rendering panel "${panel.title}" from dashboard "${dashboard.dashboard.title}". ` +
                  `Time range: ${input.from} to ${input.to}. ` +
                  (variables.length > 0
                    ? `Variables: ${variables.map((v) => `${v.name}=${v.current_value}`).join(", ")}.`
                    : ""),
              },
            ],
            _meta: {
              ui: {
                resourceUri,
                csp: `frame-src ${config.grafanaBaseUrl};`,
              },
              result,
            },
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      // Handle errors gracefully
      if (error instanceof GrafanaApiError) {
        let message = `Grafana API error (${error.status}): `;

        switch (error.status) {
          case 401:
            message +=
              "Authentication failed. Check GRAFANA_SERVICE_TOKEN is valid.";
            break;
          case 403:
            message +=
              "Access denied. Service account needs Viewer role for this resource.";
            break;
          case 404:
            message += "Resource not found. Check dashboard UID or panel ID.";
            break;
          case 429:
            message +=
              "Rate limited. Grafana is throttling requests. Wait and retry.";
            break;
          default:
            message += error.message;
        }

        throw new Error(message);
      }

      throw error;
    }
  });

  return server;
}
