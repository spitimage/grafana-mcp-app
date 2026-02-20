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
 * Time Range Presets and Utilities
 */

export interface TimeRangePreset {
  label: string;
  from: string;
  to: string;
}

export const TIME_RANGE_PRESETS: TimeRangePreset[] = [
  { label: "Last 5 minutes", from: "now-5m", to: "now" },
  { label: "Last 15 minutes", from: "now-15m", to: "now" },
  { label: "Last 30 minutes", from: "now-30m", to: "now" },
  { label: "Last 1 hour", from: "now-1h", to: "now" },
  { label: "Last 3 hours", from: "now-3h", to: "now" },
  { label: "Last 6 hours", from: "now-6h", to: "now" },
  { label: "Last 12 hours", from: "now-12h", to: "now" },
  { label: "Last 24 hours", from: "now-24h", to: "now" },
  { label: "Last 2 days", from: "now-2d", to: "now" },
  { label: "Last 7 days", from: "now-7d", to: "now" },
  { label: "Last 30 days", from: "now-30d", to: "now" },
  { label: "Last 90 days", from: "now-90d", to: "now" },
  { label: "Today", from: "now/d", to: "now/d" },
  { label: "This week", from: "now/w", to: "now/w" },
  { label: "This month", from: "now/M", to: "now/M" },
];

/**
 * Find the preset label for a given from/to pair
 */
export function findPresetLabel(from: string, to: string): string {
  const preset = TIME_RANGE_PRESETS.find(
    (p) => p.from === from && p.to === to
  );
  return preset ? preset.label : "Custom";
}
