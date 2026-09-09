const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('window.RESOURCES ='))[1];
const context = {window: {}};
vm.runInNewContext(script, context);
const resources = context.window.RESOURCES;
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'data/resource-checks-2026-09-09.json'), 'utf8'));
function key(url) {
  const parsed = new URL(url);
  const bvid = parsed.pathname.match(/\/video\/(BV[\w]+)/)?.[1];
  return bvid ? `${bvid}:p${parsed.searchParams.get('p') || 1}` : url;
}
const keys = resources.map(r => key(r.url));
assert.equal(new Set(keys).size, resources.length, 'Duplicate course URLs, including implicit p=1');
const checked = resources.filter(r => r.verifiedAt === '2026-09-09');
assert.equal(checked.length, 60);
assert.equal(evidence.length, 60);
assert.equal(new Set(evidence.map(e => e.cid)).size, 60, 'Duplicate video parts');
for (const entry of evidence) {
  const resource = checked.find(r => r.url === entry.url);
  assert(resource, `Missing checked resource: ${entry.url}`);
  assert.equal(resource.up, entry.owner.name);
  assert.equal(resource.subject, entry.subject);
  assert.equal(resource.dur, Math.ceil(entry.durationSeconds / 60));
  assert.equal(resource.verifiedAt, entry.checkedAt);
  assert.equal(entry.state, 0);
  assert.equal(entry.ugcPay, 0);
  assert.equal(new URL(entry.url).hostname, 'www.bilibili.com');
  assert.equal(key(entry.url), `${entry.bvid}:p${entry.page}`);
  assert(entry.cid > 0 && entry.durationSeconds > 0);
  assert(!resource.audit.includes('审核通过'));
}
assert.equal(checked.filter(r => r.subject === '化学').length, 40);
assert.equal(checked.filter(r => r.subject === '生物').length, 12);
assert.equal(checked.filter(r => r.subject === '地理').length, 8);
assert(checked.filter(r => r.subject === '生物').every(r => r.intro.includes('旧版')));
console.log('PASS: batch metadata, unique BV+part and CID, duration, subjects, verification scope');
console.log(JSON.stringify({total: resources.length, collections: resources.filter(r => r.dur === 0).length,
  subjects: resources.reduce((counts, r) => { counts[r.subject] = (counts[r.subject] || 0) + 1; return counts; }, {})}));
