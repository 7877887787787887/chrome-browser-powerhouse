# Chrome Browser Pages deployment

This repository workflow is designed for the existing Cloudflare Pages project `chrome-browser`. It uses GitHub Actions and Wrangler; no paid deployment plugin is required.

## Files included in a deployment

The workflow builds `_worker.js` from `index.html`, then stages only `index.html` and `_worker.js` in `dist/`. It deliberately does not publish `config.json`, backups, server logs, `node_modules`, or the local server files.

## One-time GitHub setup

1. This repository is currently public, as approved by the owner. Its source code is visible to everyone; do not commit secrets, credentials, local configuration, or server files.
2. Add the deployment source files and `.github/workflows/pages-deployment.yml`.
3. In the repository, open **Settings → Secrets and variables → Actions → New repository secret**.
4. Add `CLOUDFLARE_API_TOKEN` with a Cloudflare token limited to **Account → Cloudflare Pages → Edit**, scoped only to the account containing `chrome-browser`.
5. Add `CLOUDFLARE_ACCOUNT_ID` with the account ID for that same account.
6. Never put either value in source files, workflow YAML, commits, or chat.

## Deployment safeguards

- Every run validates JavaScript syntax, validates the HTML inline script, regenerates the worker, and prepares a clean deployment directory before deployment.
- A push to `main` can deploy only after those checks pass and both repository secrets are present.
- Manual runs default to validation-only. Set the `confirm_deploy` input to `true` only when you intend to deploy production.
- Missing credentials stop the workflow before Wrangler runs.
- The source files and workflow are being installed into the existing GitHub repository. Production deployment remains blocked until both Actions secrets are configured and validation succeeds.
