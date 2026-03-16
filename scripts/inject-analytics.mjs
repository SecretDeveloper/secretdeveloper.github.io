import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const configToml = readFileSync("config.toml", "utf8");
const measurementIdMatch = configToml.match(
  /\[params\.analytics\.google\][\s\S]*?^id\s*=\s*"([^"]+)"/m,
);

if (!measurementIdMatch) {
  throw new Error("Could not find [params.analytics.google].id in config.toml");
}

const measurementId = measurementIdMatch[1];
const tagMarker = `googletagmanager.com/gtag/js?id=${measurementId}`;
const targetDirs = ["docs/games", "docs/projects", "docs/presentations"];
const snippet = [
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>`,
  "<script>",
  "window.dataLayer = window.dataLayer || [];",
  "function gtag(){dataLayer.push(arguments);}",
  "gtag('js', new Date());",
  `gtag('config', '${measurementId}');`,
  "</script>",
].join("\n");

function walk(dir) {
  const entries = readdirSync(dir);
  let files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files = files.concat(walk(fullPath));
      continue;
    }
    if (fullPath.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

let updated = 0;
for (const dir of targetDirs) {
  for (const file of walk(dir)) {
    const html = readFileSync(file, "utf8");
    if (html.includes(tagMarker) || !html.includes("</head>")) {
      continue;
    }

    writeFileSync(file, html.replace("</head>", `${snippet}\n</head>`));
    updated += 1;
  }
}

console.log(`Analytics tag injected into ${updated} generated HTML file(s).`);
