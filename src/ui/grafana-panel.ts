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
 * MCP App Entry Point
 */

import { App } from "@modelcontextprotocol/ext-apps";
import { ControlBar } from "./components/ControlBar.js";
import { StatusBanner } from "./components/StatusBanner.js";
import {
  buildClientEmbedUrl,
  type EmbedUrlBase,
  type EmbedUrlParams,
} from "./lib/url-builder.js";

// Import CSS
import "./styles/app.css";

// Types matching server-side types
interface VariableDef {
  name: string;
  label?: string;
  type: "query" | "custom" | "interval";
  current_value: string;
  options: Array<{ text: string; value: string }>;
  multi: boolean;
  include_all: boolean;
}

interface RenderPanelResult {
  grafana_base_url: string;
  dashboard_uid: string;
  dashboard_title: string;
  panel_id: number;
  panel_title: string;
  panel_type: string;
  panel_description?: string;
  embed_url: string;
  org_id: number;
  from: string;
  to: string;
  variables: VariableDef[];
  fallback_image_b64?: string;
}

// Initialize components
const app = new App({
  name: "Grafana Panel Viewer",
  version: "1.0.0",
});

const controlBar = new ControlBar();
const statusBanner = new StatusBanner();

let currentPanelData: RenderPanelResult | null = null;
let dashboardSlug: string = "panel";

// Handle tool result
app.ontoolresult = (result: any) => {
  try {
    // Extract RenderPanelResult from tool result
    const data = extractPanelData(result);

    if (!data) {
      statusBanner.showError("Could not parse panel data from tool result");
      return;
    }

    currentPanelData = data;
    dashboardSlug = extractSlug(data.embed_url);

    renderPanel(data);
  } catch (error) {
    statusBanner.showError(
      `Error rendering panel: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Extract RenderPanelResult from MCP tool result
 */
function extractPanelData(result: any): RenderPanelResult | null {
  // Check _meta.result first (standard MCP app tool response)
  if (result?._meta?.result) {
    return result._meta.result;
  }

  // Check if result itself is the data
  if (result?.grafana_base_url && result?.panel_id) {
    return result;
  }

  return null;
}

/**
 * Extract slug from embed URL
 */
function extractSlug(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    const pathParts = url.pathname.split("/");
    // URL format: /d-solo/{uid}/{slug}
    return pathParts[3] || "panel";
  } catch {
    return "panel";
  }
}

/**
 * Render panel with controls and iframe
 */
function renderPanel(data: RenderPanelResult): void {
  statusBanner.showLoading(`Loading ${data.panel_title}...`);

  // Render control bar
  controlBar.render({
    from: data.from,
    to: data.to,
    variables: data.variables,
    onchange: (newParams) => {
      handleControlChange(newParams);
    },
  });

  // Load Grafana iframe
  loadFrame(data.embed_url, data.fallback_image_b64, data.panel_title);
}

/**
 * Handle control bar changes (time range or variables)
 */
function handleControlChange(params: {
  from: string;
  to: string;
  variables: Record<string, string>;
}): void {
  if (!currentPanelData) return;

  // Rebuild embed URL with new parameters
  const newUrl = buildClientEmbedUrl(
    {
      grafana_base_url: currentPanelData.grafana_base_url,
      dashboard_uid: currentPanelData.dashboard_uid,
      panel_id: currentPanelData.panel_id,
      org_id: currentPanelData.org_id,
    },
    {
      from: params.from,
      to: params.to,
      variables: params.variables,
    },
    dashboardSlug
  );

  // Update iframe src
  const frame = document.getElementById("grafana-frame") as HTMLIFrameElement;
  if (frame) {
    statusBanner.showLoading("Updating panel...");
    frame.src = newUrl;
  }

  // Update model context (debounced notification to Claude)
  updateModelContext(params);
}

/**
 * Notify Claude about user's control changes
 */
function updateModelContext(params: {
  from: string;
  to: string;
  variables: Record<string, string>;
}): void {
  if (!currentPanelData) return;

  const varSummary =
    Object.keys(params.variables).length > 0
      ? Object.entries(params.variables)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : "none";

  app.updateModelContext({
    content: [
      {
        type: "text",
        text:
          `User updated panel "${currentPanelData.panel_title}": ` +
          `time range ${params.from} to ${params.to}, ` +
          `variables: ${varSummary}`,
      },
    ],
  });
}

/**
 * Load Grafana iframe with timeout and fallback
 */
function loadFrame(
  embedUrl: string,
  fallbackB64: string | undefined,
  panelTitle: string
): void {
  const frame = document.getElementById("grafana-frame") as HTMLIFrameElement;
  const fallbackContainer = document.getElementById("fallback-container");

  if (!frame) {
    statusBanner.showError("Panel container not found");
    return;
  }

  // Hide fallback initially
  if (fallbackContainer) {
    fallbackContainer.hidden = true;
  }
  frame.hidden = false;

  // Set timeout for iframe load
  const IFRAME_TIMEOUT = 10000; // 10 seconds
  const timeout = setTimeout(() => {
    if (fallbackB64) {
      showFallback(fallbackB64, panelTitle);
    } else {
      statusBanner.showWarning(
        "Panel iframe timed out. Grafana may not be reachable from your browser."
      );
    }
  }, IFRAME_TIMEOUT);

  // Handle successful load
  frame.onload = () => {
    clearTimeout(timeout);
    statusBanner.hide();
  };

  // Handle error
  frame.onerror = () => {
    clearTimeout(timeout);
    if (fallbackB64) {
      showFallback(fallbackB64, panelTitle);
    } else {
      statusBanner.showError(
        "Could not load Grafana panel. Check your network connection."
      );
    }
  };

  // Load the iframe
  frame.src = embedUrl;
}

/**
 * Show fallback PNG image
 */
function showFallback(base64Image: string, panelTitle: string): void {
  const frame = document.getElementById("grafana-frame") as HTMLIFrameElement;
  const fallbackContainer = document.getElementById("fallback-container");
  const fallbackImage = document.getElementById(
    "fallback-image"
  ) as HTMLImageElement;
  const fallbackCaption = document.getElementById("fallback-caption");

  if (!fallbackContainer || !fallbackImage || !fallbackCaption) return;

  // Hide iframe, show fallback
  frame.hidden = true;
  fallbackContainer.hidden = false;

  // Set image
  fallbackImage.src = `data:image/png;base64,${base64Image}`;
  fallbackImage.alt = panelTitle;

  // Set caption
  fallbackCaption.textContent =
    `Static snapshot of "${panelTitle}" — live panel unavailable. ` +
    `Grafana may not be reachable from your browser.`;

  statusBanner.showWarning(
    "Showing static snapshot. Live panel unavailable."
  );
}

// Connect to MCP host
app.connect();

console.log("Grafana Panel Viewer initialized");
