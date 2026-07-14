# Project conventions

See `ARCHITECTURE.md` for the full system design and `ATS-CHECKER-BUILD-PLAN.md`
for the production build plan this project is being built against.

## Paddle integration

When writing or modifying code that integrates with Paddle:

- Always check current Paddle documentation via the `paddle-docs` MCP server
  before suggesting code. The Paddle API and SDKs evolve frequently — do not
  rely on training data alone.
- Use the official Node SDK: `@paddle/paddle-node-sdk`.
- All development uses the **sandbox** environment. Sandbox API keys contain
  `_sdbx`; sandbox client-side tokens are prefixed with `test_`.
- Always verify webhook signatures before acting on the payload, via
  `paddle.webhooks.unmarshal()`.
- For destructive account changes (updating prices, archiving products,
  cancelling subscriptions), ask for explicit confirmation before calling the
  `paddle-sandbox` or `paddle-live` MCP server.
- Use `paddle-sandbox` by default. Only call `paddle-live` when the prompt
  explicitly mentions live, production, or real customer data.
- API keys and webhook secrets live in environment variables — never inline
  credentials into code.
- Credits must only ever be granted from the **webhook** handler, never from
  the checkout success-redirect page (the redirect can be closed, refreshed,
  or forged).
- Webhook idempotency is mandatory: store the Paddle event id with a UNIQUE
  constraint and no-op on replay — Paddle will redeliver the same event.
