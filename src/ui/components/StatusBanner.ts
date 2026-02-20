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
 * Status Banner Component
 *
 * Shows loading, error, and warning states above the control bar.
 */

export type BannerType = "loading" | "error" | "warning" | "info";

export class StatusBanner {
  private container: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById("status-banner");
  }

  /**
   * Show a loading message
   */
  showLoading(message: string): void {
    this.show(message, "loading");
  }

  /**
   * Show an error message
   */
  showError(message: string): void {
    this.show(message, "error");
  }

  /**
   * Show a warning message
   */
  showWarning(message: string): void {
    this.show(message, "warning");
  }

  /**
   * Show an info message
   */
  showInfo(message: string): void {
    this.show(message, "info");
  }

  /**
   * Hide the banner
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = "none";
      this.container.className = "status-banner";
      this.container.textContent = "";
    }
  }

  /**
   * Show a message with type
   */
  private show(message: string, type: BannerType): void {
    if (!this.container) return;

    this.container.textContent = message;
    this.container.className = `status-banner status-${type}`;
    this.container.style.display = "block";
  }
}
