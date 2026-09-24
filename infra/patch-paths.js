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

var srcDir = path.resolve(__dirname, "..", "src");
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

  // File relative to the project root (e.g. "src/a/b/c.ts")
  var relFromRoot = path.relative(path.resolve(__dirname, ".."), file);

  // Compute how deep this file is inside src/
  var relFromSrc = path.relative(srcDir, path.dirname(file));
  var up = relFromSrc === "." ? "./" : relFromSrc.split(path.sep).map(function () { return ".."; }).join("/") + "/";

  // Matches:
  //   from "@/..."         import specifiers in .ts/.tsx
  //   from '@/...'         same with single quotes
  //   require("@/...")     require() calls
  var pattern = /(from\s*["']|require\(["'])@\/([^"']+["'])/g;
  var changed = false;
  content = content.replace(pattern, function (match, prefix, rest) {
    changed = true;
    count++;
    return prefix + up + rest;
  });

  if (changed) {
    fs.writeFileSync(file, content, "utf8");
  }
}

console.log("Replaced " + count + " @/ imports across " + files.length + " source files.");