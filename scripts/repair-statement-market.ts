/** Native Node 26 operator entrypoint; no runtime config or application migrations. */
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
const usage = `Usage:
  node scripts/repair-statement-market.ts --db EXISTING.sqlite --plan NEW-PLAN.json
  node scripts/repair-statement-market.ts --db EXISTING.sqlite --apply PLAN.json --audit AUDIT.json

--plan reads the database only. --apply requires the exact database path recorded
in the plan and persists a recoverable original/target audit before any updates.
Keep the plan and audit private: they contain original statement and trade evidence.
`;
async function main(args: string[]): Promise<void> {
  if (args.length === 1 && args[0] === "--help") { process.stdout.write(usage); return; }
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!["--db", "--plan", "--apply", "--audit"].includes(key) || !value || value.startsWith("--") || options.has(key)) throw new Error(`Invalid or duplicate argument: ${key}\n${usage}`);
    options.set(key, value);
  }
  const db = options.get("--db");
  const planPath = options.get("--plan");
  const applyPath = options.get("--apply");
  const auditPath = options.get("--audit");
  if (!db || Boolean(planPath) === Boolean(applyPath) || (planPath && auditPath) || (applyPath && !auditPath)) throw new Error(`Explicit --db and one valid mode are required.\n${usage}`);
  const modulePath = new URL("../app/lib/storage/statement-market-repair.ts", import.meta.url).href;
  const repair: typeof import("../app/lib/storage/statement-market-repair") = await import(modulePath);
  if (planPath) {
    const plan = repair.createStatementMarketRepairPlan(db);
    repair.writeStatementMarketRepairPlan(plan, planPath);
    process.stdout.write(`${JSON.stringify({ status: "planned", changedEvents: plan.changes.length, skipped: plan.skipped.length, planPath: resolve(planPath) })}\n`);
  } else if (applyPath && auditPath) {
    const output = repair.statementMarketRepairOutputPath(auditPath);
    if (output === realpathSync(applyPath)) throw new Error("Audit output must not overwrite the repair plan");
    const result = repair.applyStatementMarketRepairPlan(db, repair.readStatementMarketRepairPlan(applyPath), output);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
