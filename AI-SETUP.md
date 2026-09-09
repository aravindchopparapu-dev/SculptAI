# Secure AI connection for SculptAI Version 2

The website and saved workouts work now. Connected AI is still off. This guide prepares activation; no key has been created, credit purchased, or paid API request sent.

## Your setup steps

1. Enable the **OpenAI Developers** plugin in Codex, if it is available for your account. Its `openai-platform-api-key` skill supports creating or reusing a project key through the approved flow. This plugin is not currently callable in this task.
2. Sign in to your own [OpenAI API project](https://platform.openai.com/settings/organization/projects). Use a dedicated SculptAI project so its usage and credentials are separate from other work. Review that project's billing and usage controls before enabling requests. ChatGPT sign-in to the website is separate from API billing. [OpenAI billing explanation](https://help.openai.com/en/articles/9039756).
3. Tell Codex: “The OpenAI Developers plugin is enabled. Help me connect my SculptAI Version 2 project securely.” You do not need to paste a key into this chat. If your account cannot enable the plugin, leave AI off and we will confirm an available secure secret-entry workflow first.

## Configuration I will complete after the secure connection is available

| Setting | Where it belongs | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Version 2 Sites runtime environment, marked secret | Authorizes server requests to your API project |
| `OPENAI_MODEL` | Version 2 Sites runtime environment | An available Responses API model selected for your budget and latency needs |

The target is **SculptAI Version 2 Future Studio**, project `appgprj_6a9f66350b408191b305303ba6032539`. Version 1 is separate.

I will use the connector's secret flag, verify presence without printing the value, and deploy the saved V2 version so the environment revision is applied. The key does not belong in browser code, `NEXT_PUBLIC_*`, hosting.json, a source commit, screenshots, or this document. Local `.env` configuration alone does not configure the hosted website.

## Acceptance before calling live AI ready

- Ask a normal training question using a synthetic test profile and confirm the response is labelled “Connected AI guide.”
- Check a question with missing data, a request to change a plan, an unsafe request and a verified-source question. Confirm no record changes without a separate confirmation.
- Check provider rejection/unavailability and verify the built-in guide remains available.
- Check that responses match saved records, and inspect request timing and API-project usage. Existing mocks do not establish real provider quality or latency.

The current adapter sends your question, goal, equipment, plan and recent completed sets. It excludes account identity and free-text workout/profile notes. Eligible adopted nutrition targets may be included. It requests no response storage (`store: false`); this is not a promise that the provider has no operational retention. The app has a per-user 20-request hourly live limit, a 15-second timeout and no AI tools that can modify records.

## Pause or recover

If connection checks fail, core workout logging still works. We can remove the live API setting and redeploy to return to the built-in guide. Revoke a compromised project key through your API account and replace the Sites secret. Never include the compromised value in an issue or chat.

This workflow follows the local [Sites environment guidance](<C:/Users/aravi/.codex/plugins/cache/openai-bundled/sites/0.1.57/skills/sites-hosting/references/environment.md>): “If the skill is unavailable, ask the user to install or enable the plugin.” Current product API details: [OpenAI text generation guide](https://developers.openai.com/api/docs/guides/text).
