/**
 * infra/patch-paths.js
 * 
 * Replace `@/` path alias imports with relative imports in all .ts / .tsx files
 * under src/.  The `@/` alias is defined in tsconfig.json as `["./src/*"]`.
 *
 * This is needed because Payload's `tsx` loader (v4.22.4) does NOT resolve
 * tsconfig.json `paths` at runtime.  The Next.js build is unaffected — it uses
 * its own bundler, not tsx.
 *
 * From a file at `src/a/b/c.ts`, `@/lib/x` becomes `../../lib/x`.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var srcDir = path.resolve(__dirname, "src");
var files = [];

function walk(dir) {
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (/\.(ts|tsx)$/.test(e.name)) files.push(full);
  }
}
walk(srcDir);

var count = 0;
for (var a = 0; a < files.length; a++) {
  var file = files[a];
  var content = fs.readFileSync(file, "utf8");

  // Compute how deep this file is inside src/
  var relFromSrc = path.relative(srcDir, path.dirname(file));
  var up = relFromSrc === "." ? "./" : relFromSrc.split(path.sep).map(function () { return ".."; }).join("/") + "/";

  // Matches:
  //   from "@/..."         import specifiers in .ts/.tsx
  //   from '@/...'         same with single quotes
  //   require("@/...")     require() calls
  var pattern = /(from\s*["']|require\(["'])@\/([^"']+["'])/g;
  content = content.replace(pattern, function (match, prefix, rest) {
    count++;
    return prefix + up + rest;
  });

  // Also add .ts extension to any remaining relative imports that lack one.
  // tsx's ESM loader does not add .ts extensions automatically (same root
  // cause as the path-alias issue: tsx's register hook delegates to Node's
  // default resolver when it doesn't recognise the file).
  var relNoExt = /(from\s*["']|require\(["']|import\(["'])(\.\.?\/[^"']+)(["'])/g;
  content = content.replace(relNoExt, function (match, prefix, specifier, quote) {
    // Skip if it already has a recognised extension, is a Node bare specifier
    // (starts with 'node:'), or is a package name (no leading '.')
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) return match;
    if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css|svg|png|jpg|woff2?)$/.test(specifier)) return match;
    count++;
    return prefix + specifier + ".ts" + quote;
  });

  if (content !== fs.readFileSync(file, "utf8")) {
    fs.writeFileSync(file, content, "utf8");
  }
}

console.log("Replaced " + count + " @/ imports across " + files.length + " source files.");