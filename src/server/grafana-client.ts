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
 * Grafana API Client
 */

import {
  DashboardSearchResult,
  DashboardDetail,
  GrafanaApiError,
} from "./types.js";

interface GrafanaClientConfig {
  baseUrl: string;
  token: string;
  orgId: number;
  timeout?: number;
}

export class GrafanaClient {
  private baseUrl: string;
  private token: string;
  private orgId: number;
  private timeout: number;

  // Circuit breaker state (Phase 2, Section 6.8)
  private consecutiveFailures = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private circuitOpen = false;
  private circuitOpenUntil = 0;

  constructor(config: GrafanaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = config.token;
    this.orgId = config.orgId;
    this.timeout = config.timeout || 10000;
  }

  /**
   * Search for dashboards
   * GET /api/search?query=&type=dash-db&tag=
   */
  async searchDashboards(params: {
    query?: string;
    tags?: string[];
    limit?: number;
  }): Promise<DashboardSearchResult[]> {
    const url = new URL(`${this.baseUrl}/api/search`);
    url.searchParams.set("type", "dash-db");

    if (params.query) {
      url.searchParams.set("query", params.query);
    }

    if (params.tags && params.tags.length > 0) {
      params.tags.forEach((tag) => url.searchParams.append("tag", tag));
    }

    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }

    return this.fetchWithRetry<DashboardSearchResult[]>(() =>
      this.fetch(url.toString())
    );
  }

  /**
   * Get dashboard details by UID
   * GET /api/dashboards/uid/:uid
   */
  async getDashboard(uid: string): Promise<DashboardDetail> {
    const url = `${this.baseUrl}/api/dashboards/uid/${uid}`;
    return this.fetchWithRetry<DashboardDetail>(() => this.fetch(url));
  }

  /**
   * Get current organization
   * GET /api/org
   */
  async getOrg(): Promise<{ id: number; name: string }> {
    const url = `${this.baseUrl}/api/org`;
    return this.fetchWithRetry<{ id: number; name: string }>(() =>
      this.fetch(url)
    );
  }

  /**
   * Render panel as PNG image (fallback path)
   * GET /render/d-solo/:uid/:slug?panelId=&from=&to=&width=&height=
   */
  async renderPanelImage(params: {
    uid: string;
    slug?: string;
    panelId: number;
    from: string;
    to: string;
    variables: Record<string, string>;
    width?: number;
    height?: number;
  }): Promise<ArrayBuffer | null> {
    const url = new URL(
      `${this.baseUrl}/render/d-solo/${params.uid}/${params.slug || "panel"}`
    );

    url.searchParams.set("orgId", String(this.orgId));
    url.searchParams.set("panelId", String(params.panelId));
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    url.searchParams.set("width", String(params.width || 1000));
    url.searchParams.set("height", String(params.height || 500));

    // Add variables
    for (const [name, value] of Object.entries(params.variables)) {
      url.searchParams.set(`var-${name}`, value);
    }

    try {
      // Don't use retry for image rendering (it's optional)
      return await this.fetchImage(url.toString());
    } catch (error) {
      // If renderer returns 404, it's not installed - return null
      if (error instanceof GrafanaApiError && error.status === 404) {
        return null;
      }
      // Other errors also return null (best effort)
      return null;
    }
  }

  /**
   * Internal fetch wrapper with circuit breaker and timeout
   */
  private async fetch<T>(url: string): Promise<T> {
    // Check circuit breaker
    if (this.circuitOpen) {
      if (Date.now() < this.circuitOpenUntil) {
        throw new Error(
          `Circuit breaker open. Grafana has failed ${this.CIRCUIT_BREAKER_THRESHOLD} consecutive times. ` +
            `Retry after ${new Date(this.circuitOpenUntil).toISOString()}`
        );
      }
      // Reset circuit breaker after cooldown
      this.circuitOpen = false;
      this.consecutiveFailures = 0;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success: reset failure counter
      this.consecutiveFailures = 0;

      if (!response.ok) {
        const text = await response.text();
        throw new GrafanaApiError(response.status, text);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === "AbortError") {
        this.consecutiveFailures++;
        this.checkCircuitBreaker();
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      // Handle Grafana API errors
      if (error instanceof GrafanaApiError) {
        // Don't count 4xx errors as failures (they're client errors)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        // Count 5xx errors as failures
        this.consecutiveFailures++;
        this.checkCircuitBreaker();
        throw error;
      }

      // Handle network errors
      this.consecutiveFailures++;
      this.checkCircuitBreaker();
      throw error;
    }
  }

  /**
   * Fetch image (returns ArrayBuffer)
   */
  private async fetchImage(url: string): Promise<ArrayBuffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new GrafanaApiError(response.status, text);
      }

      return await response.arrayBuffer();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Image render timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Check circuit breaker threshold and open if needed
   */
  private checkCircuitBreaker(): void {
    if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpen = true;
      this.circuitOpenUntil = Date.now() + 60_000; // 60s cooldown
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    options = { maxRetries: 3, baseDelay: 1000 }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof GrafanaApiError) {
          if (error.status >= 400 && error.status < 500) {
            throw error;
          }
        }

        // Don't retry on last attempt
        if (attempt === options.maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = options.baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}
