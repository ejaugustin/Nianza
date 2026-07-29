# Nianza — working notes for Claude

## Deployment: always deploy to prod, not the `default` config-env

`Backend/samconfig.toml` has two deploy profiles:

- `[default.deploy.parameters]` -> stack `nianza-backend-dev`, in AWS account
  `869935087622`. This stack is **not** what the mobile app talks to.
- `[prod.deploy.parameters]` -> stack `nianza-backend-prod`, in AWS account
  `672061768724` ("nianza-prod"). **This is the real backend** -- confirmed
  by `MobileApp/.env`'s `EXPO_PUBLIC_API_URL`, which points at
  `https://gr8d5s0yl9.execute-api.us-east-2.amazonaws.com/prod/mobile/v1`.

`app.json`'s `extra.apiUrl` fallback (`https://api-dev.nianza.com/...`) is
dead code -- that domain isn't even registered (confirmed via DNS lookup,
including against 8.8.8.8). `.env` always overrides it, so this fallback
never actually gets used in practice.

**Always deploy with `sam deploy --config-env prod`, not the bare
`sam deploy` / `--config-env default`.** Before troubleshooting "is my
backend fix actually live," check `MobileApp/.env`'s `EXPO_PUBLIC_API_URL`
first to confirm which stack/account the app is really pointed at, rather
than assuming.

This distinction caused a real multi-hour debugging detour (July 2026): a
voice-memory save kept failing with an S3-style SigV4 signature error
because the feature's infrastructure (S3 bucket, DynamoDB table, Lambda
routes) had only ever been deployed to `nianza-backend-dev`, which the app
never talks to.

To deploy to prod when only CloudShell has valid AWS credentials for that
account (not the local machine): in CloudShell (nianza-prod, us-east-2), run
`aws configure export-credentials --format powershell` and paste the three
`$Env:AWS_...` lines into the local PowerShell session before running
`sam build` / `sam deploy --config-env prod`. These are short-lived
session credentials (expire ~1 hour), so do the deploy in one sitting.
