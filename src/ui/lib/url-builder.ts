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
 * Client-Side Grafana Embed URL Builder
 *
 * Mirrors server-side embed-url-builder.ts but runs in the browser.
 * Rebuilds embed URLs when time range or variables change without server calls.
 */

export interface EmbedUrlBase {
  grafana_base_url: string;
  dashboard_uid: string;
  panel_id: number;
  org_id: number;
}

export interface EmbedUrlParams {
  from: string;
  to: string;
  variables: Record<string, string | string[]>;
  refresh?: string;
  theme?: "light" | "dark";
}

/**
 * Build a Grafana panel embed URL on the client side
 */
export function buildClientEmbedUrl(
  base: EmbedUrlBase,
  params: EmbedUrlParams,
  slug: string = "panel"
): string {
  const url = new URL(
    `${base.grafana_base_url}/d-solo/${base.dashboard_uid}/${slug}`
  );

  // Required parameters
  url.searchParams.set("orgId", String(base.org_id));
  url.searchParams.set("panelId", String(base.panel_id));
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);

  // Variables (support multi-value)
  for (const [name, value] of Object.entries(params.variables)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(`var-${name}`, v));
    } else {
      url.searchParams.set(`var-${name}`, value);
    }
  }

  // Optional parameters
  if (params.theme) {
    url.searchParams.set("theme", params.theme);
  }

  // Kiosk mode (always enabled for clean embeds)
  url.searchParams.set("kiosk", "1");

  if (params.refresh) {
    url.searchParams.set("refresh", params.refresh);
  }

  return url.toString();
}
