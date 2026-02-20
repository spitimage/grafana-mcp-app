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
 * Grafana Setup Script
 *
 * Creates TestData datasource and a sample dashboard for testing the MCP App.
 *
 * Usage:
 *   node scripts/setup-grafana.js
 *
 * Environment variables:
 *   GRAFANA_URL - Grafana base URL (default: http://localhost:3000)
 *   GRAFANA_USER - Admin username (default: admin)
 *   GRAFANA_PASSWORD - Admin password (default: admin)
 */

const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3000';
const GRAFANA_USER = process.env.GRAFANA_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin';

const authHeader = 'Basic ' + Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');

async function makeRequest(path, options = {}) {
  const url = `${GRAFANA_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      ...options.headers,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function createTestDataDatasource() {
  console.log('Creating TestData datasource...');

  try {
    const datasource = await makeRequest('/api/datasources', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TestData',
        type: 'testdata',
        access: 'proxy',
        isDefault: true,
      }),
    });

    console.log('✅ TestData datasource created');
    console.log(`   ID: ${datasource.id}`);
    console.log(`   UID: ${datasource.datasource.uid}`);
    return datasource.datasource.uid;
  } catch (error) {
    if (error.message.includes('409') || error.message.includes('already exists')) {
      console.log('ℹ️  TestData datasource already exists');

      // Get existing datasource
      const datasources = await makeRequest('/api/datasources');
      const testData = datasources.find(ds => ds.type === 'testdata' || ds.type === 'grafana-testdata-datasource');

      if (testData) {
        console.log(`   ID: ${testData.id}`);
        console.log(`   UID: ${testData.uid}`);
        return testData.uid;
      }

      throw new Error('TestData datasource exists but could not retrieve UID');
    }
    throw error;
  }
}

async function createTestDashboard(datasourceUid) {
  console.log('\nCreating test dashboard...');

  const dashboard = {
    dashboard: {
      title: 'MCP Test Dashboard',
      tags: ['test', 'mcp', 'demo'],
      timezone: 'browser',
      editable: true,
      refresh: '30s',
      panels: [
        {
          id: 1,
          type: 'timeseries',
          title: 'Random Walk',
          gridPos: { h: 9, w: 12, x: 0, y: 0 },
          datasource: { type: 'testdata', uid: datasourceUid },
          targets: [
            {
              datasource: { type: 'testdata', uid: datasourceUid },
              refId: 'A',
              scenarioId: 'random_walk',
              seriesCount: 1,
            },
          ],
          fieldConfig: {
            defaults: {
              color: { mode: 'palette-classic' },
              custom: {
                axisLabel: '',
                axisPlacement: 'auto',
                fillOpacity: 10,
                gradientMode: 'none',
                lineInterpolation: 'linear',
                lineWidth: 2,
                pointSize: 5,
                showPoints: 'never',
                spanNulls: false,
              },
              mappings: [],
              thresholds: {
                mode: 'absolute',
                steps: [{ color: 'green', value: null }],
              },
            },
          },
          options: {
            legend: {
              calcs: [],
              displayMode: 'list',
              placement: 'bottom',
            },
            tooltip: {
              mode: 'single',
              sort: 'none',
            },
          },
        },
        {
          id: 2,
          type: 'timeseries',
          title: 'Sine Wave',
          gridPos: { h: 9, w: 12, x: 12, y: 0 },
          datasource: { type: 'testdata', uid: datasourceUid },
          targets: [
            {
              datasource: { type: 'testdata', uid: datasourceUid },
              refId: 'A',
              scenarioId: 'predictable_pulse',
              stringInput: '',
            },
          ],
          fieldConfig: {
            defaults: {
              color: { mode: 'palette-classic' },
              custom: {
                axisLabel: '',
                axisPlacement: 'auto',
                fillOpacity: 10,
                gradientMode: 'none',
                lineInterpolation: 'smooth',
                lineWidth: 2,
                pointSize: 5,
                showPoints: 'never',
              },
              mappings: [],
              thresholds: {
                mode: 'absolute',
                steps: [{ color: 'green', value: null }],
              },
            },
          },
          options: {
            legend: {
              calcs: [],
              displayMode: 'list',
              placement: 'bottom',
            },
            tooltip: {
              mode: 'single',
            },
          },
        },
        {
          id: 3,
          type: 'stat',
          title: 'Current Value',
          gridPos: { h: 5, w: 6, x: 0, y: 9 },
          datasource: { type: 'testdata', uid: datasourceUid },
          targets: [
            {
              datasource: { type: 'testdata', uid: datasourceUid },
              refId: 'A',
              scenarioId: 'random_walk',
            },
          ],
          fieldConfig: {
            defaults: {
              color: { mode: 'thresholds' },
              mappings: [],
              thresholds: {
                mode: 'absolute',
                steps: [
                  { color: 'green', value: null },
                  { color: 'red', value: 80 },
                ],
              },
            },
          },
          options: {
            reduceOptions: {
              values: false,
              calcs: ['lastNotNull'],
              fields: '',
            },
            orientation: 'auto',
            textMode: 'auto',
            colorMode: 'value',
            graphMode: 'area',
            justifyMode: 'auto',
          },
        },
        {
          id: 4,
          type: 'table',
          title: 'Data Table',
          gridPos: { h: 5, w: 18, x: 6, y: 9 },
          datasource: { type: 'testdata', uid: datasourceUid },
          targets: [
            {
              datasource: { type: 'testdata', uid: datasourceUid },
              refId: 'A',
              scenarioId: 'csv_metric_values',
              stringInput: 'time,series1,series2\n1,100,200\n2,150,175\n3,125,225',
            },
          ],
          options: {
            showHeader: true,
          },
        },
      ],
      schemaVersion: 38,
      version: 0,
    },
    message: 'Created via MCP setup script',
    overwrite: false,
  };

  try {
    const result = await makeRequest('/api/dashboards/db', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    });

    console.log('✅ Dashboard created successfully');
    console.log(`   UID: ${result.uid}`);
    console.log(`   URL: ${GRAFANA_URL}${result.url}`);
    console.log(`   Panels: 4 (Random Walk, Sine Wave, Current Value, Data Table)`);

    return result.uid;
  } catch (error) {
    if (error.message.includes('409') || error.message.includes('already exists')) {
      console.log('ℹ️  Dashboard with this title already exists');
      console.log('   Delete it in Grafana UI or use overwrite=true in the script');
      return null;
    }
    throw error;
  }
}

async function createServiceAccount() {
  console.log('\n📝 Creating service account (optional)...');

  try {
    // Create service account
    const sa = await makeRequest('/api/serviceaccounts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'mcp-server',
        role: 'Viewer',
      }),
    });

    console.log('✅ Service account created');
    console.log(`   ID: ${sa.id}`);
    console.log(`   Name: ${sa.name}`);

    // Create token
    const token = await makeRequest(`/api/serviceaccounts/${sa.id}/tokens`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'mcp-token',
      }),
    });

    console.log('✅ Service account token created');
    console.log(`\n⚠️  IMPORTANT: Save this token - it won't be shown again!`);
    console.log(`   GRAFANA_SERVICE_TOKEN=${token.key}`);
    console.log(`\nAdd this to your .env file`);

    return token.key;
  } catch (error) {
    if (error.message.includes('409') || error.message.includes('already exists')) {
      console.log('ℹ️  Service account already exists');
      console.log('   You can create a new token in Grafana UI:');
      console.log('   Configuration → Service accounts → mcp-server → Tokens');
      return null;
    }

    // Service accounts might not be available in all Grafana versions
    if (error.message.includes('404')) {
      console.log('⚠️  Service accounts not available in this Grafana version');
      console.log('   You can use a regular API key instead:');
      console.log('   Configuration → API Keys → Add API key');
      return null;
    }

    throw error;
  }
}

async function main() {
  console.log('🚀 Grafana MCP App Setup');
  console.log('========================\n');
  console.log(`Grafana URL: ${GRAFANA_URL}`);
  console.log(`Admin User: ${GRAFANA_USER}\n`);

  try {
    // Check Grafana health
    console.log('Checking Grafana connection...');
    await makeRequest('/api/health');
    console.log('✅ Grafana is running\n');

    // Create datasource
    const datasourceUid = await createTestDataDatasource();

    // Create dashboard
    const dashboardUid = await createTestDashboard(datasourceUid);

    // Create service account (optional)
    const token = await createServiceAccount();

    // Summary
    console.log('\n✅ Setup complete!');
    console.log('==================\n');

    if (dashboardUid) {
      console.log('Test the MCP App with:');
      console.log('```json');
      console.log(JSON.stringify({
        dashboard_uid: dashboardUid,
        panel_id: 1,
      }, null, 2));
      console.log('```\n');
    }

    console.log('Next steps:');
    console.log('1. Update .env with your GRAFANA_SERVICE_TOKEN');
    console.log('2. Run: npm run build');
    console.log('3. Run: npm start');
    console.log('4. Test with basic-host at http://localhost:8080\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Is Grafana running? Check: curl http://localhost:3000/api/health');
    console.error('- Are credentials correct? Default is admin/admin');
    console.error('- Check Grafana logs: docker logs grafana');
    process.exit(1);
  }
}

main();
