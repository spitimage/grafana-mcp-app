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
 * Control Bar Component
 *
 * Renders time range picker and variable dropdowns above the Grafana iframe.
 */

import { TIME_RANGE_PRESETS, findPresetLabel } from "../lib/time-ranges.js";

export interface VariableDef {
  name: string;
  label?: string;
  type: "query" | "custom" | "interval";
  current_value: string;
  options: Array<{ text: string; value: string }>;
  multi: boolean;
  include_all: boolean;
}

export interface ControlBarState {
  from: string;
  to: string;
  variables: VariableDef[];
  onchange: (params: {
    from: string;
    to: string;
    variables: Record<string, string>;
  }) => void;
}

export class ControlBar {
  private container: HTMLElement | null = null;
  private state: ControlBarState | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    this.container = document.getElementById("control-bar");
  }

  /**
   * Render the control bar with current state
   */
  render(state: ControlBarState): void {
    this.state = state;

    if (!this.container) return;

    // Build HTML
    const html = `
      <div class="control-bar-content">
        <div class="control-bar-left">
          ${this.renderVariables()}
        </div>
        <div class="control-bar-right">
          ${this.renderTimeRange()}
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach event listeners
    this.attachListeners();
  }

  /**
   * Render variable dropdowns
   */
  private renderVariables(): string {
    if (!this.state || this.state.variables.length === 0) {
      return "";
    }

    return this.state.variables
      .map((variable) => {
        const label = variable.label || variable.name;
        const id = `var-${variable.name}`;

        const options = variable.include_all
          ? [
              { text: "All", value: "$__all" },
              ...variable.options,
            ]
          : variable.options;

        return `
        <div class="control-group">
          <label for="${id}">${this.escapeHtml(label)}</label>
          <select
            id="${id}"
            name="${variable.name}"
            class="control-select variable-select"
            ${variable.multi ? "multiple" : ""}
          >
            ${options
              .map(
                (opt) => `
              <option
                value="${this.escapeHtml(opt.value)}"
                ${opt.value === variable.current_value ? "selected" : ""}
              >
                ${this.escapeHtml(opt.text)}
              </option>
            `
              )
              .join("")}
          </select>
        </div>
      `;
      })
      .join("");
  }

  /**
   * Render time range picker
   */
  private renderTimeRange(): string {
    if (!this.state) return "";

    const currentLabel = findPresetLabel(this.state.from, this.state.to);

    return `
      <div class="control-group">
        <label for="time-range">Time range</label>
        <select id="time-range" class="control-select time-select">
          ${TIME_RANGE_PRESETS.map(
            (preset) => `
            <option
              value="${this.escapeHtml(preset.from)}|${this.escapeHtml(preset.to)}"
              ${preset.label === currentLabel ? "selected" : ""}
            >
              ${this.escapeHtml(preset.label)}
            </option>
          `
          ).join("")}
        </select>
      </div>
    `;
  }

  /**
   * Attach event listeners to controls
   */
  private attachListeners(): void {
    // Time range change
    const timeSelect = document.getElementById(
      "time-range"
    ) as HTMLSelectElement | null;
    if (timeSelect) {
      timeSelect.addEventListener("change", () => this.handleChange());
    }

    // Variable changes
    const varSelects = document.querySelectorAll(".variable-select");
    varSelects.forEach((select) => {
      select.addEventListener("change", () => this.handleChange());
    });
  }

  /**
   * Handle any control change (debounced)
   */
  private handleChange(): void {
    if (!this.state) return;

    // Clear existing debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce for 500ms to avoid excessive updates
    this.debounceTimer = window.setTimeout(() => {
      this.emitChange();
    }, 500);
  }

  /**
   * Emit change event with current values
   */
  private emitChange(): void {
    if (!this.state) return;

    // Get time range
    const timeSelect = document.getElementById(
      "time-range"
    ) as HTMLSelectElement | null;
    let from = this.state.from;
    let to = this.state.to;

    if (timeSelect && timeSelect.value) {
      const [newFrom, newTo] = timeSelect.value.split("|");
      from = newFrom;
      to = newTo;
    }

    // Get variables
    const variables: Record<string, string> = {};
    this.state.variables.forEach((variable) => {
      const select = document.getElementById(
        `var-${variable.name}`
      ) as HTMLSelectElement | null;

      if (select) {
        if (variable.multi) {
          // Multi-value variable
          const selected = Array.from(select.selectedOptions).map(
            (opt) => opt.value
          );
          variables[variable.name] = selected.join("|");
        } else {
          variables[variable.name] = select.value;
        }
      } else {
        // Preserve current value if select not found
        variables[variable.name] = variable.current_value;
      }
    });

    // Call onChange callback
    this.state.onchange({ from, to, variables });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
