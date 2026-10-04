import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectAlerts, countByRisk, failingAlerts, formatSummary, formatTable, missingUrls, reportedUrls, type ZapReport } from './zap-report.ts';

const alert = (pluginid: string, name: string, riskcode: string, uris: string[]) => ({
  pluginid,
  name,
  riskcode,
  instances: uris.map((uri) => ({ uri, method: 'GET' })),
});
const report: ZapReport = {
  site: [
    {
      '@name': 'http://localhost:8000',
      alerts: [
        alert('10038', 'Content Security Policy (CSP) Header Not Set', '2', ['http://localhost:8000/chats', 'http://localhost:8000/settings?tab=1']),
        alert('10020', 'Missing Anti-clickjacking Header', '2', ['http://localhost:8000/chats']),
        alert('10062', 'PII Disclosure', '3', ['http://localhost:8000/api/chats']),
        alert('10021', 'X-Content-Type-Options Header Missing', '1', ['http://localhost:8000/']),
      ],
    },
  ],
};

test('counts the alerts by risk', () => {
  assert.deepEqual(countByRisk(collectAlerts(report)), { High: 1, Medium: 2, Low: 1, Informational: 0 });
});

test('only High fails by default, Medium too with the medium threshold', () => {
  const alerts = collectAlerts(report);
  assert.deepEqual(failingAlerts(alerts).map((a) => a.pluginid), ['10062']);
  assert.equal(failingAlerts(alerts, 'medium').length, 3);
  assert.equal(failingAlerts(alerts.filter((a) => a.riskcode !== '3')).length, 0);
});

test('lists the reported URLs without query strings and finds the missing ones', () => {
  const alerts = collectAlerts(report);
  assert.deepEqual(reportedUrls(alerts), ['http://localhost:8000/', 'http://localhost:8000/api/chats', 'http://localhost:8000/chats', 'http://localhost:8000/settings']);
  assert.deepEqual(missingUrls(alerts, ['/chats', '/settings', '/api/chats']), []);
  assert.deepEqual(missingUrls(alerts, ['/chats', '/billing']), ['/billing']);
});

test('the table lists High first and the summary states the verdict', () => {
  const table = formatTable(collectAlerts(report)).split('\n');
  assert.match(table[2] ?? '', /10062.*High/);
  assert.match(formatSummary(report), /1 High alert\(s\) in the report/);
  assert.match(formatSummary({ site: [] }), /No High alerts/);
  assert.equal(formatTable([]), '_No alerts._');
});

test('drops an alert whose URLs are all out of scope', () => {
  const alerts = collectAlerts({ site: [{ alerts: [alert('10003', 'Vulnerable JS Library', '2', []), alert('10038', 'CSP', '2', ['http://localhost:8000/'])] }] });
  assert.deepEqual(alerts.map((a) => a.pluginid), ['10038']);
});
