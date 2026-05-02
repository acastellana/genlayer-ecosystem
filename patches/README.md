# Local dependency patches

This project uses `patch-package` so the Bradbury helper scripts are reproducible after `npm install`/`npm ci`.

## `genlayer-js+0.21.1.patch`

Why it exists:

- During Bradbury v2 live testing, `genlayer-js` 0.21.1 could produce rollup transactions with too-low gas headroom for consensus-main deploy/write calls.
- The symptom was a reverted/empty-dispatch rollup path even when the contract and account were otherwise valid.
- Raising the fallback gas and adding headroom around estimated gas made the deploy/write path repeatable for the v2 registry test.

Current behavior:

- Gas-estimation fallback: `200_000` -> `5_000_000`.
- Estimated gas for consensus-main sends is multiplied by `3` for local and injected wallet paths.

Important constraints:

- `genlayer-js` is pinned to `0.21.1` in `package.json` while this patch is needed.
- Do not commit direct edits under `node_modules/`; update this patch instead.
- Remove this patch once upstream `genlayer-js` exposes a Bradbury-safe gas override or fixes the underestimation behavior.

This patch affects transaction gas limits/headroom, not fee constants. The app-level fees remain `0.042 GEN` for project submission and `0.0042 GEN` for community actions.
