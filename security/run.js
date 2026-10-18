"use strict";

/**
 * Recursive security gate.
 *
 *   node security/run.js --gate        fail build/launch on HIGH findings
 *   node security/run.js --baseline    accept the current tree (after review)
 *   node security/run.js --json        machine-readable report
 *   node security/run.js --quiet       only speak when something is wrong
 *   node security/run.js --allow-drift treat baseline drift as MED (dev mode)
 *
 * The run is recursive in the narrow, honest sense:
 *   - the scanner and rules are hashed before and after the scan
 *   - the project tree is chain-hashed before and after the scan
 *   - if either changed mid-run, that is a HIGH finding (TOCTOU)
 *   - a baseline pins the accepted chain; drift is reported, not hidden
 */

const path = require("node:path");

const attest = require("./attest");
const { scanProject } = require("./scan");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    baseline: false,
    json: false,
    quiet: false,
    gate: true,
    allowDrift: false,
    root: ROOT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--baseline") args.baseline = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--quiet") args.quiet = true;
    else if (arg === "--allow-drift") args.allowDrift = true;
    else if (arg === "--no-gate") args.gate = false;
    else if (arg === "--root") {
      index += 1;
      args.root = path.resolve(argv[index] || ROOT);
    }
  }
  return args;
}

function severityCounts(findings) {
  const counts = { HIGH: 0, MED: 0, LOW: 0 };
  for (const finding of findings) {
    if (counts[finding.severity] !== undefined) counts[finding.severity] += 1;
  }
  return counts;
}

function driftToFindings(drift, allowDrift) {
  return drift.map((entry) => {
    let severity = entry.severity;
    if (allowDrift && severity === "HIGH") severity = "MED";
    return {
      ruleId: "SEC000",
      severity,
      name: `baseline ${entry.kind}`,
      file: entry.path || "security/BASELINE.json",
      line: null,
      message: entry.detail,
      remediation:
        "If the change is intentional and reviewed, re-baseline with: node security/run.js --baseline",
    };
  });
}

function printHuman(report, quiet) {
  const { counts, findings } = report;
  const failed = counts.HIGH > 0;
  if (quiet && !failed) return;

  const line = "============================================================";
  console.log(line);
  console.log(" RECURSIVE SECURITY — WARBOARD BOX");
  console.log(line);
  console.log(` tree      : ${report.fileCount} tracked files · chain ${report.chainAfter.slice(0, 16)}…`);
  console.log(` tooling   : ${report.toolingHash.slice(0, 16)}…  (scanner+rules hash)`);
  console.log(` baseline  : ${report.baseline.present ? report.baseline.chainRoot.slice(0, 16) + "…" : "NONE — run --baseline"}`);
  console.log(` scanned   : ${report.scannedFiles} files`);
  console.log(` findings  : ${counts.HIGH} HIGH · ${counts.MED} MED · ${counts.LOW} LOW`);
  console.log("");

  if (findings.length === 0) {
    console.log(" PASS — no findings. The tree matches the accepted baseline.");
  } else {
    for (const finding of findings) {
      const where = finding.file + (finding.line ? `:${finding.line}` : "");
      console.log(` ${finding.severity.padEnd(4)} ${finding.ruleId} ${finding.name}`);
      console.log(`      ${where} — ${finding.message}`);
      console.log(`      fix: ${finding.remediation}`);
    }
  }

  console.log("");
  if (failed) {
    console.log(" GATE FAILED — HIGH findings block build/launch.");
    console.log(" Review them, fix them, or (if the change is intentional) re-baseline.");
  } else {
    console.log(" GATE PASSED — no HIGH findings.");
  }
  console.log(" report: security/report.json");
  console.log(line);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.baseline) {
    const before = attest.snapshot(args.root);
    const baseline = attest.writeBaseline(args.root);
    const scan = scanProject(args.root);
    const counts = severityCounts(scan.findings);
    console.log(`baseline written: ${baseline.fileCount} files · chain ${baseline.chainRoot.slice(0, 16)}…`);
    console.log(`current findings: ${counts.HIGH} HIGH · ${counts.MED} MED · ${counts.LOW} LOW`);
    if (counts.HIGH > 0) {
      console.log("WARNING: baseline recorded while HIGH findings exist. Fix them before shipping.");
    }
    const after = attest.snapshot(args.root);
    if (before.chainRoot !== after.chainRoot) {
      console.log("WARNING: tree changed while baselining. Re-run --baseline.");
      process.exitCode = 1;
    }
    return;
  }

  const before = attest.snapshot(args.root);
  const baseline = attest.readBaseline(args.root);
  const scan = scanProject(args.root);
  const compared = attest.compareToBaseline(args.root, baseline);
  const after = attest.snapshot(args.root);

  const findings = [...scan.findings];

  if (compared.current.chainRoot !== after.chainRoot || before.chainRoot !== after.chainRoot) {
    findings.push({
      ruleId: "SEC099",
      severity: "HIGH",
      name: "tree changed during scan",
      file: "security/run.js",
      line: null,
      message: "The project tree or tooling changed between the before/after hashes (TOCTOU).",
      remediation: "Stop other writers, then re-run the security gate.",
    });
  }
  if (before.toolingHash !== after.toolingHash) {
    findings.push({
      ruleId: "SEC099",
      severity: "HIGH",
      name: "security tooling changed during scan",
      file: "security/",
      line: null,
      message: "The scanner or rules changed while scanning.",
      remediation: "Freeze the tooling, re-run, then re-baseline intentionally.",
    });
  }

  findings.push(...driftToFindings(compared.drift, args.allowDrift));

  const counts = severityCounts(findings);
  const report = {
    generatedAt: new Date().toISOString(),
    version: 1,
    root: args.root,
    toolingHash: after.toolingHash,
    chainBefore: before.chainRoot,
    chainAfter: after.chainRoot,
    baseline: {
      present: Boolean(baseline),
      chainRoot: baseline ? baseline.chainRoot : null,
      generatedAt: baseline ? baseline.generatedAt : null,
    },
    fileCount: after.fileCount,
    scannedFiles: scan.scannedFiles,
    counts,
    passed: counts.HIGH === 0,
    findings,
  };

  attest.writeReport(args.root, report);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report, args.quiet);
  }

  if (args.gate && counts.HIGH > 0) {
    process.exitCode = 1;
  }
}

main();
