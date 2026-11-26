import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
async function sources(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.filter((item) => !['node_modules','.next','dist','.turbo'].includes(item.name)).map(async (item) => {
    const file = path.join(dir, item.name);
    return item.isDirectory() ? sources(file) : /\.(?:tsx|css)$/.test(item.name) ? [file] : [];
  }));
  return groups.flat();
}
const files = (await Promise.all(['apps/web-user/app','apps/web-user/components','apps/web-admin/app','apps/web-admin/components','apps/web-tenant/app','packages/staff/src','packages/ui/src'].map((dir) => sources(path.join(root,dir))))).flat();
const errors = [];
for (const file of files) {
  if (file.endsWith('tokens.css')) continue;
  const text = await readFile(file,'utf8');
  if (/#[0-9a-f]{3,8}\b/i.test(text) || /(?:rgb|rgba|hsl|hsla)\(/i.test(text)) errors.push(path.relative(root,file) + ': literal color outside tokens');
  if (/linear-gradient|radial-gradient/i.test(text)) errors.push(path.relative(root,file) + ': decorative gradient');
  if (/font-family\s*:[^;]*\bInter\b/i.test(text)) errors.push(path.relative(root,file) + ': unreviewed Inter font');
  if (/border-radius\s*:\s*[1-9]|font-size\s*:\s*\d|box-shadow\s*:\s*\d/i.test(text)) errors.push(path.relative(root,file) + ': literal font/radius/shadow');
}
for (const page of ['landing','checkout','tracker','admin','denah']) await readFile(path.join(root,'docs/design/pages',page + '.md'),'utf8');
assert.deepEqual(errors,[],errors.join('\n'));
console.log('Design guard passed: ' + files.length + ' TSX/CSS files, tokens centralized, no literal colors or decorative gradients.');
console.log('Scope: static token/pattern checks only; browser and human review remain required.');

