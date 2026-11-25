import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const skipped = new Set(['node_modules', '.next', '.next-qa-auth', '.git', '.turbo', 'dist', 'reference']);
async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.filter((entry) => !skipped.has(entry.name)).map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolute);
    return entry.name.endsWith('.md') ? [absolute] : [];
  }));
  return groups.flat();
}
const master = await readFile(path.join(root, 'docs/MASTER.md'), 'utf8');
const features = (await readdir(path.join(root, 'docs/features'))).filter((file) => /^F-\d{2}-.+\.md$/.test(file)).sort();
assert.equal(features.length, 11, 'All eleven feature specifications must exist');
for (const [index, file] of features.entries()) {
  const text = await readFile(path.join(root, 'docs/features', file), 'utf8');
  assert.ok(file.startsWith('F-' + String(index + 1).padStart(2, '0')), 'Feature IDs must be consecutive');
  const status = text.match(/\*\*Status:\*\* (draft|in-review|approved|deprecated)/)?.[1];
  assert.ok(status, 'Feature status is required: ' + file);
  assert.ok(master.includes('features/' + file + ') | ' + status + ' |'), 'MASTER status mismatch: ' + file);
  assert.equal((text.match(/^## \d+\. /gm) ?? []).length, 10, 'Template sections required: ' + file);
  for (let section = 1; section <= 10; section++) assert.ok(text.includes('## ' + section + '. '), 'Missing section: ' + file);
}
const docs = await markdownFiles(root);
for (const file of docs) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]?.split('#')[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    await access(path.resolve(path.dirname(file), target));
  }
}
console.log('Documentation OK: ' + features.length + ' complete features, matching MASTER statuses, ' + docs.length + ' Markdown files with valid local links.');

