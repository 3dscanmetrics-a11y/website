import { cpSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

const includeExact = new Set([
  'index.html',
  'contact.html',
  'styles.css',
  'script.js',
  'llms.txt',
  'sitemap.xml',
  'robots.txt',
  'hero_scan.png',
  'scan_to_bim_bg.png',
  'industry-civil-infrastructure.html',
  'industry-mining.html',
  'industry-property-development.html',
]);

const includeDirs = ['assets', 'services', 'locations'];

const SITE_ORIGIN = 'https://3dscanmetrics.co.za';
const SOCIAL_IMAGE = `${SITE_ORIGIN}/hero_scan.png`;

function publicPathFor(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return `/${normalized.slice(0, -'/index.html'.length)}`;
  return `/${normalized.replace(/\.html$/, '')}`;
}

function optimizeHtml(filePath, relativePath) {
  let html = readFileSync(filePath, 'utf8');

  // Repair malformed JSON-LD left by the original page generator.
  html = html.replaceAll('type=""application/ld+json""', 'type="application/ld+json"');
  html = html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (script, json) => `<script type="application/ld+json">${json.replaceAll('""', '"')}</script>`,
  );

  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1]?.trim();
  if (!title || !description) return;

  const canonical = `${SITE_ORIGIN}${publicPathFor(relativePath)}`;
  const existingCanonical = /<link rel="canonical" href="[^"]*"\s*\/?>/i;
  html = existingCanonical.test(html)
    ? html.replace(existingCanonical, `<link rel="canonical" href="${canonical}">`)
    : html.replace('</title>', `</title>\n    <link rel="canonical" href="${canonical}">`);

  const socialMeta = `
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="3D Scan Metrics">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${SOCIAL_IMAGE}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${SOCIAL_IMAGE}">`;
  html = html.replace('</head>', `${socialMeta}\n</head>`);

  writeFileSync(filePath, html);
}

function optimizeHtmlTree(directory, relativeDirectory = '') {
  for (const name of readdirSync(directory)) {
    const fullPath = join(directory, name);
    const relativePath = join(relativeDirectory, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) optimizeHtmlTree(fullPath, relativePath);
    else if (name.endsWith('.html')) optimizeHtml(fullPath, relativePath);
  }
}

function shouldSkip(name) {
  return (
    name === 'dist' ||
    name === 'node_modules' ||
    name === 'src' ||
    name === 'migrations' ||
    name === 'scripts' ||
    name === '.git' ||
    name === '.wrangler' ||
    name.startsWith('patch') ||
    name.endsWith('.ps1') ||
    name.endsWith('.py') ||
    name === 'package-lock.json' ||
    name === 'package.json' ||
    name === 'wrangler.jsonc' ||
    name === 'template_header.html' ||
    name === 'template_footer.html'
  );
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const name of readdirSync(root)) {
  if (shouldSkip(name)) continue;
  const src = join(root, name);
  const st = statSync(src);
  if (st.isDirectory()) {
    if (!includeDirs.includes(name)) continue;
    cpSync(src, join(dist, name), { recursive: true });
  } else if (
    includeExact.has(name) ||
    name.endsWith('.html') ||
    name.endsWith('.css') ||
    name.endsWith('.png') ||
    name.endsWith('.xml') ||
    name === 'robots.txt' ||
    name === 'llms.txt' ||
    name === 'script.js'
  ) {
    if (name.endsWith('.js') && name !== 'script.js') continue;
    cpSync(src, join(dist, name));
  }
}

optimizeHtmlTree(dist);

console.log(`Built static assets -> ${relative(root, dist)}`);
