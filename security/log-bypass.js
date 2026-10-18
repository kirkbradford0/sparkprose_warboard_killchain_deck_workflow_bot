"use strict";

/**
 * Record a deliberate security-gate bypass.
 *
 * The bypass exists for a broken install, not for production. It cannot run
 * silently: the launcher calls this script, which requires SKIP_SECURITY=1 and
 * appends a human-readable, timestamped line to security/bypass.log.
 *
 *   set SKIP_SECURITY=1
 *   set SKIP_SECURITY_REASON=install is broken; rebuilding runtime
 *   START-WARBOARD-BOX.cmd
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (process.env.SKIP_SECURITY !== "1") {
  console.error("log-bypass: SKIP_SECURITY must be exactly '1' to bypass the gate");
  process.exit(2);
}

const reason = String(process.env.SKIP_SECURITY_REASON || "").trim();
if (reason.length < 8) {
  console.error("log-bypass: SKIP_SECURITY_REASON must describe why (8+ characters)");
  process.exit(2);
}

const line = {
  at: new Date().toISOString(),
  host: os.hostname(),
  user: os.userInfo().username,
  reason: reason.slice(0, 300),
  note: "security gate bypassed at launch; not a production shortcut",
};

const file = path.join(__dirname, "bypass.log");
fs.appendFileSync(file, JSON.stringify(line) + "\n", "utf8");
console.log(`SECURITY BYPASS LOGGED to ${file}`);
console.log(`  reason: ${line.reason}`);
