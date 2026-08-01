import { backup, DatabaseSync } from "node:sqlite";

const [databasePath, command = ""] = process.argv.slice(2);

function fail(message) {
  process.stderr.write(`sqlite-cli: ${message}\n`);
  process.exitCode = 2;
}

function quotedPath(text) {
  const match = text.match(/^\.(?:backup|restore)\s+(['"])(.+)\1$/i);
  return match?.[2];
}

if (!databasePath || !command) {
  fail("usage: sqlite-cli.mjs DATABASE COMMAND");
} else {
  const normalized = command.trim().replace(/;\s*$/, "");
  const operation = normalized.match(/^\.(backup|restore)\s+/i);

  try {
    if (operation) {
      const sourcePath = quotedPath(normalized);
      if (!sourcePath) throw new Error("backup path must be quoted");

      if (operation[1].toLowerCase() === "restore") {
        const source = new DatabaseSync(sourcePath, { readOnly: true });
        try {
          await backup(source, databasePath);
        } finally {
          source.close();
        }
      } else {
        const source = new DatabaseSync(databasePath);
        try {
          await backup(source, sourcePath);
        } finally {
          source.close();
        }
      }
    } else if (/^pragma\s+quick_check$/i.test(normalized)) {
      const database = new DatabaseSync(databasePath, { readOnly: true });
      try {
        const result = database.prepare("PRAGMA quick_check").get();
        const value = String(result?.quick_check ?? "");
        process.stdout.write(`${value}\n`);
        if (value !== "ok") process.exitCode = 1;
      } finally {
        database.close();
      }
    } else {
      throw new Error(`unsupported command: ${command}`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
