// infra/patch-lexical.js
// Run in the Docker runner stage to remove top-level `await` from Lexical
// v0.41 `.mjs` files so tsx's CJS require hook in `payload migrate` works
// on Node.js v22+ (which blocks require() of async ESM).
"use strict";
var fs = require("fs");
var path = require("path");
var RE = /^const mod = await \(process\.env\.NODE_ENV !== 'production' \? import\('\.\/(.*)\.dev\.mjs'\) : import\('\.\/(.*)\.prod\.mjs'\)\);/m;

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    var p = path.join(dir, d.name);
    if (d.isDirectory() && d.name !== "node_modules") walk(p);
    else if (d.name.endsWith(".node.mjs")) {
      var s = fs.readFileSync(p, "utf8");
      var m = s.match(RE);
      if (m) {
        var replacement = "import * as mod from './" + m[2] + ".prod.mjs';";
        fs.writeFileSync(p, s.replace(m[0], replacement));
        console.log("patched", p);
      }
    }
  });
}

walk("node_modules/@lexical");
walk("node_modules/lexical");