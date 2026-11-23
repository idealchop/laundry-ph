import { printChecks, runSelfTest } from './checklist';

async function main(): Promise<void> {
  const self = process.argv.includes('--self-test');
  if (!self) {
    console.error(
      [
        'Usage: npm run conformance -- --self-test',
        '',
        'This runs the prod-key checklist against the reference verifier.',
        'To point the same checklist at a business app, run that app with the',
        'reference middleware (examples/express-app.ts) and execute --self-test',
        'until the app passes, then keep the app\'s secrets in Secret Manager.',
        '',
        'A live app run needs:',
        '  --base https://app-dev.example/v1',
        '  --audience https://app-dev.example/v1',
        '  --key-id bridge-to-<app>-dev-v1',
        '  --secret  (from Secret Manager, not argv on a shared machine)',
        '  --id-token (Google OIDC token, aud = --audience)',
        '',
        'Do not put real secrets on the command line. Prefer env vars',
        'RIVER_HMAC_V1 / RIVER_HMAC_V2 / RIVER_ID_TOKEN, which this script',
        'reads when those flags are added by the app team.',
      ].join('\n'),
    );
    process.exit(2);
  }
  const code = printChecks(await runSelfTest());
  process.exit(code);
}

void main();
