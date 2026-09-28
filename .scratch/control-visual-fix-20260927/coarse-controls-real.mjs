import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = new URL('./evidence/', import.meta.url).pathname;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true });
const result = { input: 'Playwright emulated touchscreen and coarse pointer, not physical touch', targets: [] };
try {
  await page.goto('http://127.0.0.1:3044');
  await page.getByRole('heading', { name: '我的交易室', exact: true }).waitFor({ timeout: 60000 });
  assert(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'browser must emulate a coarse pointer');
  const nature = page.getByRole('group', { name: '交易性质', exact: true });
  for (const name of ['实盘', '模拟盘']) {
    const control = nature.getByRole('button', { name, exact: true });
    const box = await control.boundingBox();
    assert(box.height >= 42, `${name} segment is ${box.height}px`);
    result.targets.push({ label: name, width: box.width, height: box.height });
  }
  const filter = page.getByRole('button', { name: /^筛选/ });
  const filterBox = await filter.boundingBox();
  assert(filterBox.height >= 42, `filter toggle is ${filterBox.height}px`);
  result.targets.push({ label: '筛选', width: filterBox.width, height: filterBox.height });
  const allocation = page.getByRole('region', { name: '当前持仓资产分布', exact: true });
  for (const name of ['按市场', '按资产类型']) {
    const control = allocation.getByRole('button', { name, exact: true });
    const box = await control.boundingBox();
    assert(box.height >= 44, `${name} button is ${box.height}px`);
    result.targets.push({ label: name, width: box.width, height: box.height });
  }
  await page.getByRole('button', { name: '交易库', exact: true }).click();
  await page.getByRole('heading', { name: '交易库', exact: true }).waitFor();
  const unknown = page.getByRole('radio', { name: '来源未知', exact: true });
  const unknownBox = await unknown.evaluate(element => element.closest('label').getBoundingClientRect().toJSON());
  assert(unknownBox.height >= 44, `unknown radio is ${unknownBox.height}px`);
  result.targets.push({ label: '来源未知', width: unknownBox.width, height: unknownBox.height });
  const account = page.getByRole('combobox', { name: '共享账户', exact: true });
  const accountBox = await account.boundingBox();
  assert(accountBox.height >= 44, `account select is ${accountBox.height}px`);
  result.targets.push({ label: '共享账户', width: accountBox.width, height: accountBox.height });
  await page.getByRole('radio', { name: '模拟盘', exact: true }).check();
  const run = page.getByRole('textbox', { name: '共享模拟运行', exact: true });
  const runBox = await run.boundingBox();
  assert(runBox.height >= 44, `simulation input is ${runBox.height}px`);
  result.targets.push({ label: '共享模拟运行', width: runBox.width, height: runBox.height });
  await page.screenshot({ path: `${out}controls-coarse-library.png` });
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL';
  result.error = error.stack;
} finally {
  await fs.writeFile(`${out}coarse-controls-real.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
process.exitCode = result.status === 'PASS' ? 0 : 1;
