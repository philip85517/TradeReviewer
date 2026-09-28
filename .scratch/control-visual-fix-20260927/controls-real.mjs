import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = new URL('./evidence/', import.meta.url).pathname;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const result = { checks: [], pageErrors: [] };
page.on('pageerror', error => result.pageErrors.push(error.message));
const check = async (name, run) => {
  const evidence = await run();
  result.checks.push({ name, status: 'PASS', evidence });
};

try {
  await page.goto('http://127.0.0.1:3044');
  await page.getByRole('heading', { name: '我的交易室', exact: true }).waitFor({ timeout: 60000 });

  await check('default holdings allocation density and document width', async () => {
    const allocation = page.getByRole('region', { name: '当前持仓资产分布', exact: true });
    await allocation.waitFor();
    const box = await allocation.boundingBox();
    assert(box.height < 900, `allocation is too tall: ${box.height}`);
    const disclosures = await allocation.locator('details').evaluateAll(items => items.map(item => ({
      open: item.open,
      summary: item.querySelector('summary')?.innerText,
      bodyHeight: item.querySelector(':scope > :not(summary)')?.getBoundingClientRect().height ?? 0,
    })));
    assert(disclosures.every(item => !item.open), 'diagnostic explanations must start collapsed');
    await page.getByRole('heading', { name: '我的交易室', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}controls-room-after.png` });
    const widths = [];
    for (const width of [1440, 821, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      widths.push(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })));
      assert(widths.at(-1).scroll <= width + 1, `document overflow at ${width}: ${JSON.stringify(widths.at(-1))}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    return { allocationHeight: box.height, columns: await page.locator('[aria-label="当前持仓"] thead th').count(), disclosures, widths };
  });

  await page.getByRole('button', { name: '交易库', exact: true }).click();
  await page.getByRole('heading', { name: '交易库', exact: true }).waitFor();
  await check('library scope radio semantics and shared control alignment', async () => {
    const group = page.getByRole('group', { name: '交易性质', exact: true });
    const layout = await group.evaluate(element => {
      const legend = element.querySelector('[aria-hidden="true"]').getBoundingClientRect();
      const options = element.querySelector('div').getBoundingClientRect();
      const labels = [...element.querySelectorAll('label')].map(label => ({
        text: label.innerText,
        height: label.getBoundingClientRect().height,
      }));
      return {
        legendTop: legend.top,
        legendBottom: legend.bottom,
        optionsTop: options.top,
        optionsBottom: options.bottom,
        verticalCenterDifference: Math.abs((legend.top + legend.height / 2) - (options.top + options.height / 2)),
        labels,
      };
    });
    assert(layout.verticalCenterDifference < 5, `legend and radios are not inline: ${JSON.stringify(layout)}`);
    const account = page.getByRole('combobox', { name: '共享账户', exact: true });
    const accountHeight = await account.evaluate(element => element.getBoundingClientRect().height);
    assert(accountHeight >= 32 && accountHeight <= 36, `account select height: ${accountHeight}`);
    await page.screenshot({ path: `${out}controls-library-after.png` });

    const simulation = page.getByRole('radio', { name: '模拟盘', exact: true });
    await simulation.check();
    assert(await simulation.isChecked());
    await page.getByRole('radio', { name: '实盘', exact: true }).check();
    assert(await page.getByRole('radio', { name: '实盘', exact: true }).isChecked());
    const unknown = page.getByRole('radio', { name: '来源未知', exact: true });
    await unknown.check();
    assert(await unknown.isChecked());
    return { legendAlignment: layout, accountHeight, natureTransitions: ['simulation', 'live', 'unknown'] };
  });
  assert.deepEqual(result.pageErrors, []);
} catch (error) {
  result.checks.push({ name: 'setup/unhandled', status: 'FAIL', error: error.stack });
} finally {
  await fs.writeFile(`${out}controls-real.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
process.exitCode = result.checks.some(item => item.status === 'FAIL') ? 1 : 0;
