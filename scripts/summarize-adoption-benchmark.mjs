import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        current += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    if (char !== "\r") {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  return dataRows
    .filter((candidate) => candidate.some((value) => value.trim().length > 0))
    .map((candidate) => Object.fromEntries(header.map((key, index) => [key, candidate[index] ?? ""])));
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return 1;
  }
  if (normalized === "false") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function rate(values) {
  if (values.length === 0) {
    return null;
  }
  return values.filter((value) => value > 0).length / values.length;
}

function safeReduction(baseline, aic) {
  if (baseline === null || aic === null || baseline === 0) {
    return null;
  }
  return ((baseline - aic) / baseline) * 100;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function fmtNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function fmtPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtPercentPointDelta(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(digits)} pp`;
}

function summarizeGroup(records) {
  const values = (name) => records.map((record) => toNumber(record[name])).filter((value) => value !== null);

  return {
    runs: records.length,
    successRate: rate(values("success")),
    avgContractCorrectness: average(values("contract_correctness_score")),
    avgUnsafeActions: average(values("unsafe_action_attempts")),
    avgWrongEntityAttempts: average(values("wrong_entity_attempts")),
    avgConfirmationViolations: average(values("confirmation_policy_violations")),
    validationHintRate: rate(values("validation_hint_used")),
    recoveryHintRate: rate(values("recovery_hint_used")),
    avgWorkflowAccuracy: average(values("workflow_step_accuracy")),
    avgVerificationFailures: average(values("verification_failures")),
    medianTime: median(values("completion_time_seconds")),
    medianSteps: median(values("interaction_steps")),
    medianRetries: median(values("element_retries"))
  };
}

function buildMarkdown(records, sourceName) {
  const grouped = groupBy(
    records,
    (record) => `${record.agent_name}|||${record.app_name}|||${record.scenario_id}|||${record.mode}`
  );

  const summaries = [...grouped.entries()]
    .map(([key, bucket]) => {
      const [agent, app, scenario, mode] = key.split("|||");
      return { agent, app, scenario, mode, ...summarizeGroup(bucket) };
    })
    .sort((a, b) =>
      a.agent.localeCompare(b.agent) ||
      a.app.localeCompare(b.app) ||
      a.scenario.localeCompare(b.scenario) ||
      a.mode.localeCompare(b.mode)
    );

  const byScenario = groupBy(summaries, (summary) => `${summary.agent}|||${summary.app}|||${summary.scenario}`);
  const impacts = [...byScenario.entries()]
    .map(([key, bucket]) => {
      const [agent, app, scenario] = key.split("|||");
      const baseline = bucket.find((summary) => summary.mode === "baseline");
      const aic = bucket.find((summary) => summary.mode === "aic");
      if (!baseline || !aic) {
        return null;
      }
      return {
        agent,
        app,
        scenario,
        baseline,
        aic,
        successLiftPp: ((aic.successRate ?? 0) - (baseline.successRate ?? 0)) * 100,
        contractGain: (aic.avgContractCorrectness ?? 0) - (baseline.avgContractCorrectness ?? 0),
        unsafeActionReduction: safeReduction(baseline.avgUnsafeActions, aic.avgUnsafeActions),
        wrongEntityReduction: safeReduction(baseline.avgWrongEntityAttempts, aic.avgWrongEntityAttempts),
        confirmationViolationReduction: safeReduction(
          baseline.avgConfirmationViolations,
          aic.avgConfirmationViolations
        ),
        workflowAccuracyGain: (aic.avgWorkflowAccuracy ?? 0) - (baseline.avgWorkflowAccuracy ?? 0),
        timeReductionPct: safeReduction(baseline.medianTime, aic.medianTime),
        stepReductionPct: safeReduction(baseline.medianSteps, aic.medianSteps)
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.agent.localeCompare(b.agent) ||
      a.app.localeCompare(b.app) ||
      a.scenario.localeCompare(b.scenario)
    );

  const lines = [];
  lines.push("# Adoption Benchmark Summary");
  lines.push("");
  lines.push(`Source: \`${sourceName}\``);
  lines.push("");
  lines.push("## Summary By Scenario And Mode");
  lines.push("");
  lines.push("| Agent | App | Scenario | Mode | Runs | Success Rate | Avg Contract Correctness | Avg Unsafe Actions | Avg Wrong Entity Attempts | Avg Confirmation Violations | Validation Hint Rate | Recovery Hint Rate | Avg Workflow Accuracy | Avg Verification Failures | Median Time (s) | Median Steps | Median Retries |");
  lines.push("|:---|:---|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const summary of summaries) {
    lines.push(
      `| ${summary.agent} | ${summary.app} | ${summary.scenario} | ${summary.mode} | ${summary.runs} | ${fmtPercent(summary.successRate)} | ${fmtNumber(summary.avgContractCorrectness, 2)} | ${fmtNumber(summary.avgUnsafeActions, 2)} | ${fmtNumber(summary.avgWrongEntityAttempts, 2)} | ${fmtNumber(summary.avgConfirmationViolations, 2)} | ${fmtPercent(summary.validationHintRate)} | ${fmtPercent(summary.recoveryHintRate)} | ${fmtNumber(summary.avgWorkflowAccuracy, 2)} | ${fmtNumber(summary.avgVerificationFailures, 2)} | ${fmtNumber(summary.medianTime)} | ${fmtNumber(summary.medianSteps)} | ${fmtNumber(summary.medianRetries)} |`
    );
  }

  lines.push("");
  lines.push("## Baseline vs AIC Impact");
  lines.push("");
  lines.push("| Agent | App | Scenario | Success Lift | Contract Gain | Unsafe Action Reduction | Wrong Entity Reduction | Confirmation Violation Reduction | Workflow Accuracy Gain | Time Reduction | Step Reduction |");
  lines.push("|:---|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const impact of impacts) {
    lines.push(
      `| ${impact.agent} | ${impact.app} | ${impact.scenario} | ${fmtPercentPointDelta(impact.successLiftPp)} | ${fmtNumber(impact.contractGain, 2)} | ${impact.unsafeActionReduction === null ? "-" : `${impact.unsafeActionReduction.toFixed(1)}%`} | ${impact.wrongEntityReduction === null ? "-" : `${impact.wrongEntityReduction.toFixed(1)}%`} | ${impact.confirmationViolationReduction === null ? "-" : `${impact.confirmationViolationReduction.toFixed(1)}%`} | ${fmtNumber(impact.workflowAccuracyGain, 2)} | ${impact.timeReductionPct === null ? "-" : `${impact.timeReductionPct.toFixed(1)}%`} | ${impact.stepReductionPct === null ? "-" : `${impact.stepReductionPct.toFixed(1)}%`} |`
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This summary is designed for real-app safety and correctness benchmarks, not speed-only comparisons.");
  lines.push("- Add qualitative failure transcripts and adoption-effort notes manually in the final report.");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: node scripts/summarize-adoption-benchmark.mjs <results.csv> [output.md]");
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const outputArg = process.argv[3];
  const outputPath = outputArg ? resolve(process.cwd(), outputArg) : null;
  const csv = await readFile(inputPath, "utf8");
  const records = parseCsv(csv);

  if (records.length === 0) {
    throw new Error(`No benchmark rows found in ${inputPath}`);
  }

  const markdown = buildMarkdown(records, basename(inputPath));
  if (outputPath) {
    await writeFile(outputPath, markdown, "utf8");
  } else {
    process.stdout.write(markdown);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
