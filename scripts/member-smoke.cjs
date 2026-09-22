/* oxlint-disable typescript/no-require-imports -- Standalone browser verification. */
// Run with Playwright available in NODE_PATH. Uses local sign-in in an isolated
// browser context; member writes and real AI requests are intercepted.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.SCULPTAI_TEST_URL || 'http://localhost:3001';
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    for (const config of [
      { locale: 'en-US', timezoneId: 'America/Denver', viewport: { width: 1440, height: 1000 } },
      { locale: 'en-GB', timezoneId: 'Asia/Kolkata', viewport: { width: 390, height: 844 } },
    ]) {
      const context = await browser.newContext(config);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /hydration|didn't match|invalid.*nest/i.test(message.text())) errors.push(message.text()); });
      let snapshot = null;
      let coachCalls = 0;
      await page.route('**/api/**', async route => {
        const request = route.request();
        if (request.method() !== 'POST') return route.continue();
        if (request.url().endsWith('/api/coach')) {
          assert.equal(request.postDataJSON().intent, 'fuel-explanation');
          coachCalls++;
          return route.fulfill({ json: { mode: 'openai', answer: 'Browser test explanation.' } });
        }
        if (snapshot && request.url().endsWith('/api/state') && request.postDataJSON().action?.type === 'fuelSync')
          return route.fulfill({ json: snapshot });
        if (snapshot && request.url().endsWith('/api/state') && request.postDataJSON().action?.type === 'profilePhoto') {
          const photo = request.postDataJSON().action.photo;
          snapshot = { ...snapshot, state: { ...snapshot.state, profilePhoto: photo ?? undefined }, revision: snapshot.revision + 1 };
          return route.fulfill({ json: snapshot });
        }
        throw new Error('Smoke test attempted an unexpected data mutation.');
      });
      await page.goto(`${origin}/signin-with-chatgpt?return_to=%2F%3Ftab%3Dfuel`);
      const response = await context.request.get(`${origin}/api/state`);
      assert.equal(response.status(), 200);
      snapshot = await response.json();
      assert.ok(snapshot.state.profile, 'This check needs an existing local member profile.');
      for (const tab of ['Fuel', 'Insights', 'My training', 'Coach', 'Studio']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.reload();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('nav [role="tab"][aria-selected="true"]').innerText(), tab);
        assert.equal(await page.getByText('Opening SculptAI…', { exact: true }).count(), 0);
        assert.equal(await page.getByText('Your training starts here', { exact: true }).count(), 0);
        assert.deepEqual(errors, [], `Script errors on ${tab}`);
      }
      await page.locator('.account-button').click();
      await page.getByRole('dialog').waitFor();
      const samplePhoto = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 96, height: 96 } });
      await page.getByLabel('Choose profile photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: samplePhoto });
      await page.getByAltText('Your avatar').waitFor();
      assert.match(snapshot.state.profilePhoto, /^data:image\/jpeg;base64,/);
      await page.getByRole('button', { name: 'Remove photo' }).click();
      await page.getByAltText('Your avatar').waitFor({ state: 'detached' });
      assert.equal(snapshot.state.profilePhoto, undefined);
      const age = page.getByRole('spinbutton', { name: 'Age (18+)', exact: true });
      await age.fill('34');
      await age.press('ArrowUp');
      assert.equal(await age.inputValue(), '34');
      await age.hover();
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(150);
      assert.equal(await age.inputValue(), '34', 'Trackpad scrolling must not change age');
      await age.fill('35');
      assert.equal(await age.inputValue(), '35', 'Manual typing remains available');
      await age.fill('17');
      assert.equal(await age.evaluate(el => el.validity.rangeUnderflow), true, 'Age validation stays enabled');
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Insights', exact: true }).click();
      await page.getByRole('button', { name: 'Add check-in', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      assert.equal(await page.locator('input[type="date"]').count(), 1);
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Fuel', exact: true }).click();
      await page.getByRole('button', { name: 'Explain my Fuel goals', exact: true }).click();
      await page.getByText('Browser test explanation.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Collapse explanation', exact: true }).click();
      assert.equal(await page.getByText('Browser test explanation.', { exact: true }).isVisible(), false);
      await page.getByRole('button', { name: 'Show explanation', exact: true }).click();
      await page.getByText('Browser test explanation.', { exact: true }).waitFor();
      assert.equal(coachCalls, 1);
      await page.reload();
      await page.getByRole('button', { name: 'Explain my Fuel goals', exact: true }).waitFor();
      assert.equal(await page.getByText('Browser test explanation.', { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${config.locale} / ${config.timezoneId}: signed-in refresh, navigation, forms, Fuel controls; no script errors`);
      await context.close();
    }
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    const guestErrors = [];
    guestPage.on('pageerror', error => guestErrors.push(error.message));
    await guestPage.goto(origin + '/?tab=fuel');
    await guestPage.getByText('Your training starts here', { exact: true }).waitFor();
    await guestPage.goto(origin + '/?demo=1&tab=insights');
    await guestPage.getByText('Fictional demo · saved only in this tab', { exact: true }).waitFor();
    await guestPage.reload();
    await guestPage.getByRole('heading', { name: 'Your progress, unfolding.' }).waitFor();
    assert.deepEqual(guestErrors, []);
    console.log('PASS signed-out and demo navigation / refresh');
    await guest.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
