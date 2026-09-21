import 'dotenv/config';
import { buildContainer } from '../src/container';
import { KEY_RETIRE_AFTER_MS, KEY_ROTATION_INTERVAL_MS } from '../src/constants/keys';

// Looks at the signing keys, and starts a rollover on demand.
//
//   npx tsx scripts/keys.ts          what is published, and what state each is in
//   npx tsx scripts/keys.ts rotate   publish an incoming key now
//   npx tsx scripts/keys.ts advance  move the rollover on one step
//   npx tsx scripts/keys.ts replace  replace the active key immediately
//
// `replace` is for a key that must stop being trusted now. It is not the
// rollover: the old key leaves the published set at once, so the ID tokens it
// signed stop verifying. That is the point of it.
//
// A rollover takes effect at the next boot. oidc-provider fixes its key set when
// it is constructed, so the running process keeps signing with the key it
// started with — which is deliberate, not a limitation worked around: it is what
// guarantees the process never signs with a key the database has already
// retired. The state machine therefore steps only at startup.
const DAY = 24 * 60 * 60 * 1000;

function describe(state: string): string {
  switch (state) {
    case 'active':
      return 'signs';
    case 'incoming':
      return 'published, signing nothing yet';
    default:
      return 'published for verification only';
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'status';
  const container = buildContainer();
  const service = container.signingKeyService;

  if (command === 'rotate') {
    const key = await service.mint('incoming');
    console.log(`published ${key.kid} as incoming`);
    console.log(
      `it takes over at the next boot after the publish lead, and the key it ` +
        `replaces stays published for ${Math.round(KEY_RETIRE_AFTER_MS / 1000 / 60)} minutes after that.`,
    );
  } else if (command === 'replace') {
    const { minted, removed } = await service.replaceNow();
    console.log(`minted ${minted.kid} as the active key`);
    console.log(`removed ${removed.length ? removed.join(', ') : 'nothing'} from the published set`);
    console.log('every ID token signed by a removed key stops verifying now.');
  } else if (command === 'advance') {
    const { activeKid, changed } = await service.advance();
    console.log(changed ? `active key is now ${activeKid}` : `no change; active key is ${activeKid}`);
  } else if (command !== 'status') {
    console.error(`unknown command: ${command}`);
    process.exit(1);
  }

  const keys = await container.repositories.signingKeys.listPublished();
  console.log(`\n${keys.length} key(s) published at /oidc/jwks:\n`);
  for (const key of keys) {
    const age = Math.round((Date.now() - (key.activatedAt ?? key.createdAt).getTime()) / DAY);
    const retires = key.retiresAt ? `, leaves the set ${key.retiresAt.toISOString()}` : '';
    console.log(`  ${key.kid}  ${key.state.padEnd(8)} ${describe(key.state)}`);
    console.log(`    ${key.alg}, ${age} day(s) old${retires}`);
  }
  console.log(`\nrotation interval: ${Math.round(KEY_ROTATION_INTERVAL_MS / DAY)} days`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
