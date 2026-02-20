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
 * Shared Types for Grafana MCP App
 */

import { z } from "zod";

// ============================================================================
// Tool Input Schemas (Phase 2, Section 6.3)
// ============================================================================

export const SearchDashboardsInput = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const GetDashboardPanelsInput = z.object({
  dashboard_uid: z.string().min(1),
});

export const RenderPanelInput = z.object({
  dashboard_uid: z.string().min(1),
  panel_id: z.number().int().positive(),
  from: z.string().default("now-1h"),
  to: z.string().default("now"),
  variables: z.record(z.string(), z.string()).default({}),
  refresh: z.string().optional(),
});

export type SearchDashboardsInput = z.infer<typeof SearchDashboardsInput>;
export type GetDashboardPanelsInput = z.infer<typeof GetDashboardPanelsInput>;
export type RenderPanelInput = z.infer<typeof RenderPanelInput>;

// ============================================================================
// Grafana API Response Types (Phase 2, Section 12)
// ============================================================================

export interface DashboardSearchResult {
  uid: string;
  title: string;
  uri: string;
  type: "dash-db" | "dash-folder";
  tags: string[];
  isStarred: boolean;
  folderTitle?: string;
}

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  description?: string;
  gridPos: { x: number; y: number; w: number; h: number };
  panels?: GrafanaPanel[]; // For nested panels in rows
}

export interface GrafanaVariable {
  name: string;
  label?: string;
  type: "query" | "custom" | "constant" | "interval" | "datasource" | "adhoc";
  current: { text: string | string[]; value: string | string[] };
  options: Array<{ text: string; value: string; selected?: boolean }>;
  multi: boolean;
  includeAll: boolean;
  allValue?: string;
  hide: 0 | 1 | 2; // 0=visible, 1=label hidden, 2=completely hidden
}

export interface DashboardDetail {
  dashboard: {
    uid: string;
    title: string;
    panels: GrafanaPanel[];
    templating: { list: GrafanaVariable[] };
    time: { from: string; to: string };
    schemaVersion: number;
  };
  meta: {
    slug: string;
    url: string;
    created: string;
    updated: string;
  };
}

// ============================================================================
// Tool Result Types (Phase 2, Section 6.3)
// ============================================================================

export interface VariableOption {
  text: string;
  value: string;
}

export interface VariableDef {
  name: string;
  label?: string;
  type: "query" | "custom" | "constant" | "interval" | "datasource";
  current_value: string;
  options: VariableOption[];
  multi: boolean;
  include_all: boolean;
}

export interface RenderPanelResult {
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

// ============================================================================
// Error Types (Phase 2, Section 6.8)
// ============================================================================

export class GrafanaApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public response?: string
  ) {
    super(message);
    this.name = "GrafanaApiError";
  }
}
