/* oxlint-disable typescript/no-require-imports -- Local browser acceptance */
const {
  chromium,
} = require('C:/Users/aravi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'),
  assert = require('node:assert/strict');
async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: '__sites_local_auth', value: '1', url: 'http://localhost:3001' },
    ]);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    const response = await page.request.get('http://localhost:3001/api/state');
    const data = await response.json();
    assert.equal(
      data.state.profile?.name,
      'SculptAI QA',
      'Only the local fictional QA profile may be used',
    );
    async function capture(step, file) {
      await page.screenshot({ path: `outputs/${file}`, fullPage: true });
      await page.screenshot({ path: 'outputs/live-test.png' });
      fs.writeFileSync(
        'outputs/test-status.json',
        JSON.stringify({ step, updated: Date.now() }),
      );
    }
    await page.getByRole('tab', { name: 'Insights', exact: true }).click();
    await page.getByRole('heading', { name: 'Strength over time' }).waitFor();
    await page.getByRole('combobox', { name: 'Exercise to compare' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: 'Repetitions per set' }).waitFor();
    assert.ok((await page.getByText(/One baseline recorded/).count()) > 0);
    await page.getByText('View external load values', { exact: true }).click();
    await page.getByRole('columnheader', { name: /External load/ }).waitFor();
    await capture(
      'Passed · real strength baseline, repetition selector and accessible data table',
      'insights-trend-desktop.png',
    );
    await page.getByRole('tab', { name: 'Fuel', exact: true }).click();
    const card = page.locator('.meal-card').filter({
      has: page.getByRole('heading', {
        name: 'Lentil & rice bowl',
        exact: true,
      }),
    });
    await card.waitFor();
    await card.getByRole('combobox').click();
    await page.getByRole('option', { name: '1.5', exact: true }).click();
    await card.getByText('300 g · Lentils', { exact: true }).waitFor();
    await card.getByText(/~810/).waitFor();
    await card.getByText('Ingredient data sources', { exact: true }).click();
    assert.equal(
      await card
        .getByRole('link', { name: 'USDA · Lentils', exact: true })
        .getAttribute('href'),
      'https://fdc.nal.usda.gov/food-details/172421/nutrients',
    );
    await capture(
      'Passed · portion changes scale ingredient quantities and sourced nutrient estimates',
      'fuel-portions-desktop.png',
    );
    await page.setViewportSize({ width: 320, height: 800 });
    await capture(
      'Passed · meal portions at 320px phone width',
      'fuel-portions-mobile.png',
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole('tab', { name: 'Insights', exact: true }).click();
    await page.getByRole('heading', { name: 'Strength over time' }).waitFor();
    await capture(
      'Passed · strength charts at 320px phone width',
      'insights-trend-mobile.png',
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('svg.weight-chart')].every(
        (svg) =>
          Math.abs(
            svg.getBoundingClientRect().width - svg.viewBox.baseVal.width,
          ) < 2,
      ),
    );
    await page
      .locator('.member-card')
      .filter({
        has: page.getByRole('heading', {
          name: 'Strength over time',
          exact: true,
        }),
      })
      .screenshot({ path: 'outputs/strength-card-mobile.png' });
    await page.locator('.skip-link').focus();
    assert.equal(
      await page
        .locator('.skip-link')
        .evaluate((el) => getComputedStyle(el).clipPath),
      'none',
    );
    await page.keyboard.press('Enter');
    await page
      .getByRole('heading', { name: 'Your progress, unfolding.', exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    const result = {
      passed: true,
      checks: [
        'strength selection and baseline',
        'accessible strength values',
        'scaled meal quantities',
        'scaled estimated nutrients',
        'USDA source links',
        '320px meal and trend layouts',
        'readable mobile chart axis size',
        'keyboard skip link',
      ],
      pageErrors: errors,
    };
    fs.writeFileSync(
      'outputs/insights-meals-results.json',
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
