/* oxlint-disable typescript/no-require-imports -- Local browser test tooling */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = 'http://localhost:3001';
const output = 'outputs/spec-review';
fs.mkdirSync(output, { recursive: true });
const checks = [],
  errors = [],
  writes = [];
let browser, page;
async function state() {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('sculptai-spec-demo')),
  );
}
async function tab(name) {
  await page.getByRole('tab', { name, exact: true }).click();
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log('PASS ' + name);
}
async function run() {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.SCULPTAI_CHROME ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/state'))
      writes.push(r.url());
  });
  await page.goto(origin + '/?demo=1', { waitUntil: 'networkidle' });
  await check(
    'Anonymous and forged identity requests remain unauthorized',
    async () => {
      assert.equal(
        (await page.request.get(origin + '/api/state')).status(),
        401,
      );
      assert.equal(
        (
          await page.request.get(origin + '/api/state', {
            headers: {
              'oai-authenticated-user-id': 'fake',
              'oai-authenticated-user-email': 'fake@example.test',
            },
          })
        ).status(),
        401,
      );
      const r = await page.request.post(origin + '/api/coach', {
        data: { message: 'test' },
      });
      assert.equal(r.status(), 401);
    },
  );
  await check(
    'Readiness and four-week schedule render with a clear fictional-data boundary',
    async () => {
      await page.getByLabel('Demo persona').selectOption('Low energy day');
      await tab('My training');
      await page
        .getByRole('heading', { name: 'How are you arriving?' })
        .waitFor();
      assert.equal(
        await page.getByRole('heading', { name: /^Week [1-4]$/ }).count(),
        4,
      );
      await page.screenshot({
        path: output + '/training-desktop.png',
        fullPage: true,
      });
    },
  );
  await check(
    'Suggested recovery changes require acceptance and support immutable undo',
    async () => {
      await page
        .getByRole('button', { name: 'Review session suggestion' })
        .click();
      assert.equal((await state()).plans.length, 1);
      await page
        .getByRole('button', { name: 'Accept change', exact: true })
        .click();
      assert.equal((await state()).plans.length, 2);
      const receipt = JSON.stringify((await state()).receipts[0]);
      await page.getByRole('button', { name: 'Undo this change' }).click();
      assert.equal((await state()).plans.length, 3);
      assert.equal(JSON.stringify((await state()).receipts[0]), receipt);
      await page
        .getByRole('button', { name: 'Review session suggestion' })
        .click();
      await page.getByRole('button', { name: 'Reject suggestion' }).click();
      assert.equal((await state()).plans.length, 3);
    },
  );
  await check(
    'Progression uses saved sessions; workout autosaves and pain stops the affected movement',
    async () => {
      await page.getByLabel('Demo persona').selectOption('Experienced lifter');
      await page
        .getByRole('button', { name: 'Review session suggestion' })
        .click();
      await page
        .getByRole('button', { name: 'Accept change', exact: true })
        .click();
      assert.equal((await state()).plans.length, 2);
      await page
        .getByRole('button', { name: 'Start workout', exact: true })
        .first()
        .click();
      await page.locator('.set-entry').first().waitFor();
      const first = page.locator('.set-entry').first();
      await first.getByRole('spinbutton').nth(0).fill('12');
      await first.getByRole('spinbutton').nth(1).fill('10');
      await first.getByRole('spinbutton').nth(2).fill('7');
      await first.getByRole('spinbutton').nth(2).blur();
      await first.getByRole('button', { name: /^Complete/ }).click();
      assert.equal((await state()).sessions.at(-1).sets[0].done, true);
      await page.locator('.pain-controls summary').first().click();
      await page
        .getByRole('button', { name: 'Save pain report and stop' })
        .first()
        .click();
      const session = (await state()).sessions.at(-1);
      assert.equal(session.painEvents.length, 1);
      assert.equal(session.sets[0].done, true);
      await page
        .getByRole('button', { name: 'Finish workout', exact: true })
        .first()
        .click();
      await page
        .getByRole('button', { name: 'Confirm & save', exact: true })
        .click();
      assert.equal((await state()).sessions.at(-1).status, 'partial');
      await page.reload({ waitUntil: 'networkidle' });
      await tab('My training');
      assert.equal((await state()).sessions.at(-1).painEvents.length, 1);
    },
  );
  await check(
    'Weekly reflection persists and CSV and JSON include consent, logs and receipts',
    async () => {
      await tab('Weekly review');
      await page.getByLabel('Main barrier').selectOption('Time');
      await page.getByLabel('Days you followed your meal framework').fill('3');
      await page
        .getByLabel('What would make next week easier? (optional)')
        .fill('Prepare a shorter session');
      await page.getByRole('button', { name: 'Save weekly review' }).click();
      assert.equal((await state()).reviews.length, 1);
      await page.screenshot({
        path: output + '/weekly-desktop.png',
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Account & data', exact: true })
        .click();
      for (const name of ['Export my data', 'Export CSV']) {
        const pending = page.waitForEvent('download');
        await page.getByRole('button', { name, exact: true }).click();
        const file = await pending;
        const path = output + '/' + file.suggestedFilename();
        await file.saveAs(path);
        const contents = fs.readFileSync(path, 'utf8');
        for (const key of ['receipts', 'consents', 'sessions', 'reviews'])
          assert.ok(contents.includes(key));
      }
      await page.keyboard.press('Escape');
    },
  );
  await check(
    'All main tabs fit 360px and 320px; keyboard navigation reaches controls',
    async () => {
      for (const width of [360, 320]) {
        await page.setViewportSize({ width, height: 850 });
        for (const name of [
          'Studio',
          'My training',
          'Insights',
          'Fuel',
          'Weekly review',
          'Coach',
        ]) {
          await tab(name);
          const sizes = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
          }));
          assert.ok(
            sizes.scroll <= sizes.width + 1,
            `${name} overflow ${sizes.scroll}/${sizes.width}`,
          );
        }
      }
      await tab('My training');
      await page.screenshot({
        path: output + '/training-mobile.png',
        fullPage: true,
      });
      await page.setViewportSize({ width: 360, height: 850 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: output + '/training-mobile-viewport.png' });
      await page.keyboard.press('Tab');
      assert.ok(
        await page.evaluate(() => document.activeElement !== document.body),
      );
      await tab('Coach');
      await page
        .getByRole('heading', { name: 'Ask about your training.' })
        .waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Ask AI Coach' }).count(),
        0,
      );
    },
  );
  await check(
    'Fresh onboarding saves a profile without creating a plan or workout log',
    async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole('button', { name: 'Account & data', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Delete my SculptAI data', exact: true })
        .click();
      await page.getByLabel('Type DELETE to confirm').fill('DELETE');
      await page
        .getByRole('button', { name: 'Delete my data', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Set up your profile', exact: true })
        .click();
      await page
        .getByLabel('Preferred name', { exact: true })
        .fill('Fictional onboarding tester');
      await page.getByLabel('Age (18+)', { exact: true }).fill('32');
      for (const [label, value] of [
        ['Primary goal', 'General fitness'],
        ['Experience', 'Beginner'],
        ['Training days / week', '3'],
        ['Minutes / session', '45'],
        ['Available equipment', 'Dumbbells'],
        ['Diet preference', 'Vegetarian'],
        ['Activity level', 'Lightly active'],
      ]) {
        await page.getByRole('combobox', { name: label, exact: true }).click();
        await page.getByRole('option', { name: value, exact: true }).click();
      }
      await page
        .getByRole('button', { name: 'Save profile', exact: true })
        .focus();
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'Make today count.' }).waitFor();
      await page.getByRole('heading', { name: 'What do you want to train?' }).waitFor();
      for (const group of ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Legs', 'Glutes', 'Calves', 'Abs'])
        assert.equal(await page.getByRole('button', { name: group, exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Chest', exact: true }).click();
      await page.getByRole('button', { name: 'Biceps', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Chest', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('button', { name: 'Generate my workout' }).isDisabled(), true);
      assert.equal((await state()).plans.length, 0);
      assert.equal((await state()).sessions.length, 0);
      assert.equal(
        await page.getByRole('button', { name: 'Start workout' }).count(),
        0,
      );
      await tab('Insights');
      await page.getByRole('heading', { name: 'Your progress, unfolding.' }).waitFor();
    },
  );
  await check(
    'Demo actions never write to the account API and pages have no runtime errors',
    async () => {
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
    },
  );
  fs.writeFileSync(
    output + '/browser-results.json',
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
  await browser.close();
}
run().catch(async (error) => {
  console.error(error.stack);
  fs.writeFileSync(
    output + '/browser-results.json',
    JSON.stringify(
      { passed: false, checks, errors, error: error.message },
      null,
      2,
    ),
  );
  if (page)
    await page
      .screenshot({ path: output + '/failure.png', fullPage: true })
      .catch(() => {});
  if (browser) await browser.close();
  process.exitCode = 1;
});
