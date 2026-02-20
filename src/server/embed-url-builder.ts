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
 * Grafana Embed URL Builder
 *
 * Constructs Grafana panel embed URLs in the format:
 * {baseUrl}/d-solo/{uid}/{slug}?orgId={orgId}&panelId={panelId}&from={from}&to={to}&var-{name}={value}
 */

interface BuildEmbedUrlParams {
  baseUrl: string;
  uid: string;
  panelId: number;
  orgId: number;
  from: string;
  to: string;
  variables?: Record<string, string | string[]>;
  theme?: "light" | "dark";
  kiosk?: boolean;
  refresh?: string;
  slug?: string;
}

/**
 * Build a Grafana panel embed URL
 *
 * Example output:
 * http://localhost:3000/d-solo/abc123/dashboard-name?orgId=1&panelId=5&from=now-24h&to=now&var-cluster=prod&kiosk=1
 */
export function buildEmbedUrl(params: BuildEmbedUrlParams): string {
  // Use slug or fallback to "panel"
  const slug = params.slug || "panel";

  // Construct base URL
  const url = new URL(`${params.baseUrl}/d-solo/${params.uid}/${slug}`);

  // Add required parameters
  url.searchParams.set("orgId", String(params.orgId));
  url.searchParams.set("panelId", String(params.panelId));
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);

  // Add variables (support multi-value variables)
  if (params.variables) {
    for (const [name, value] of Object.entries(params.variables)) {
      if (Array.isArray(value)) {
        // Multi-value variable: repeat the parameter
        value.forEach((v) => url.searchParams.append(`var-${name}`, v));
      } else {
        url.searchParams.set(`var-${name}`, value);
      }
    }
  }

  // Add optional parameters
  if (params.theme) {
    url.searchParams.set("theme", params.theme);
  }

  // Kiosk mode hides Grafana chrome (recommended for embeds)
  if (params.kiosk !== false) {
    // Default to kiosk=1 unless explicitly disabled
    url.searchParams.set("kiosk", "1");
  }

  if (params.refresh) {
    url.searchParams.set("refresh", params.refresh);
  }

  return url.toString();
}
