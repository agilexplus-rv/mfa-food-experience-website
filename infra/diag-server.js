// infra/diag-server.js
// Starts an HTTP server on PORT immediately, then runs payload migrate in
// the background and captures its output for inspection via the HTTP server.
"use strict";
var http = require("http");
var childProcess = require("child_process");
var fs = require("fs");

var LOG = "/tmp/diag.log";
var PORT = process.env.PORT || 3000;

function log(s) {
  fs.appendFileSync(LOG, s + "\n");
  process.stdout.write("[diag] " + s + "\n");
}

log("=== diagnostic server starting on port " + PORT);

// Check lexical patch was applied
["node_modules/lexical/Lexical.node.mjs",
 "node_modules/@lexical/rich-text/LexicalRichText.node.mjs",
 "node_modules/@lexical/react/LexicalComposer.node.mjs"
].forEach(function (p) {
  try {
    var firstLine = fs.readFileSync(p, "utf8").split("\n").filter(Boolean).slice(7, 9).join("\n");
    log("PATCHED? " + p + " => " + (firstLine.includes("import * as mod") ? "YES" : "NO: " + firstLine.substring(0, 80)));
  } catch (e) {
    log("PATCHED? " + p + " => ERROR: " + e.message);
  }
});

// Serve current log
var server = http.createServer(function (_, res) {
  try { var body = fs.readFileSync(LOG, "utf8"); } catch (e) { var body = "waiting..."; }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(body);
});
server.listen(PORT, function () {
  log("=== server listening, running payload migrate ===");
  var proc = childProcess.spawn("./node_modules/.bin/payload", ["migrate"], {
    cwd: "/app",
    env: process.env,
    timeout: 120000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  proc.stdout.on("data", function (d) { log("STDOUT: " + d); });
  proc.stderr.on("data", function (d) { log("STDERR: " + d); });
  proc.on("close", function (code) { log("MIGRATE EXIT: " + code); });
  proc.on("error", function (e) { log("MIGRATE ERROR: " + e.message); });
});