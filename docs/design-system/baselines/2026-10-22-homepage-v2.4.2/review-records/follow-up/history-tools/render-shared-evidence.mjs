#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
const inputDir = ".scratch/homepage-v241-repair/work/history/evidence/shared";
const outputDir = ".scratch/homepage-v241-repair/work/history/evidence/shared-rendered";
fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir)
  .filter((name) => name.endsWith(".svg"))
  .sort();

for (const name of files) {
  const input = path.join(inputDir, name);
  const output = path.join(outputDir, name.replace(/\.svg$/, ".png"));
  await sharp(input).png().toFile(output);
  console.log(`${input} -> ${output}`);
}
