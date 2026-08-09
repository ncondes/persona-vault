# Build log — developer console, demo apps, OIDC persistence

Written 8 August 2026, extended 9 August with the testing stretch. A record of
what was built and, more importantly, **why each choice was made** — including
the things that were wrong first and had to be fixed. Not submission material,
but Chapter 4 (Implementation) and Chapter 5 (Evaluation) should be written from
it.

Awaiting manual review. Nothing has been committed.

## What this stretch set out to do

Add a self-service developer console: a third party signs in, registers an app,
declares the scopes it needs, gets a client ID and secret, and can see exactly
what a token for that app will return. Then three demo relying parties that
consume it, and the whole system running from one command.

Six phases, all finished:

| # | Phase | What it covers |
|---|-------|----------------|
| 0 | Dead code removal | Legacy server-rendered UI, unused helpers, stale build output |
| 1 | OIDC persistence + runtime clients | Prisma adapter, encrypted client secrets, scope catalogue |
| 2 | Console REST API | Eight endpoints under `/api/apps` |
| 3 | Console UI | Four routes, EN/ES, built from a Claude Design handoff |
| 4 | Three demo apps | Independent Next.js relying parties |
| 5 | Docker Compose | Six services, one command |

---

## The blocker nobody had noticed

The console cannot exist without a change that looks unrelated. Relying parties
were a **compile-time constant**: `src/constants/clients.ts` held three literal
objects and `createOidcProvider` turned them into a static `clients` array at
boot. The `Client` table existed and was seeded, but the OAuth layer never read
it — `secretHash` and `redirectUris` were written by the seed and read by
nothing.

Worse, there was **no oidc-provider Adapter at all**. Every session, grant,
authorization code and access token lived in memory. Restarting the API silently
broke every connected app: `Consent.grantId` pointed at a grant that no longer
existed, so revocation quietly did nothing.

That is worth stating plainly in the report. The marking criteria ask for "an API
that is robust and would be widely applicable"; an identity provider whose
clients are a constant and whose grants evaporate on restart is neither. Fixing
it is the single most technically substantial thing in this stretch.

---

## Decisions

### Where the console lives

**`/console` inside the existing Next app, open to any signed-in user.**

The alternative was a separate `developers.persona.app` with its own accounts,
which is how Google and LINE actually do it. Rejected because it would duplicate
auth, the shell, the design system and the i18n layer for a story the report can
tell either way. The Google *model* is kept — your Persona account is also your
developer account — without the second application.

Cost: the console sits in the same sidebar as a person's own vault, which is a
slight conceptual muddle. Accepted.

### How clients are stored

**A full Prisma adapter for oidc-provider, one `oidc_payload` table behind every
model.**

The cheaper option was to resolve only clients from the database and leave
everything else in memory. Rejected because it would have left the restart bug
in place and forced the report to describe it as a known limitation. The full
adapter is about 150 lines and fixes both problems at once.

Verified against the installed `oidc-provider@9.8.5` source rather than from
memory, because two things contradict older documentation:

- **`provider.Client.cacheClear()` does not exist in v9.** Nothing needs it: the
  client cache is an LRU keyed on a SHA-256 of the adapter payload's JSON, so
  editing an app in the console produces a different hash and the stale entry is
  bypassed automatically. The adapter builds that object with a fixed key order
  on purpose, and a unit test asserts the JSON is byte-stable across calls.
- **The adapter is dispatched as `isConstructable(A) ? new A(name) : A(name)`.**
  The factory must be an arrow function; a `function` declaration would be called
  with `new`. There is a unit test asserting the returned factory has no
  `prototype`, because this would fail confusingly otherwise.

### Client secrets are encrypted, not hashed

oidc-provider compares `client_secret` in plaintext (`constantEquals`), so
bcrypt is not an option. Secrets are encrypted at rest with AES-256-GCM using a
key derived from `AUTH_SECRET` via HKDF, and decrypted only when the adapter
loads a client.

This is a genuine security decision worth a paragraph in the report rather than
something to hide: the trade-off is that anyone with the database *and* the
application secret can read client secrets, which is strictly better than
plaintext at rest and strictly worse than a provider that supports
`private_key_jwt`. Rotating `AUTH_SECRET` invalidates every stored secret; the
adapter now logs a clear message and reports the app as unknown rather than
failing opaquely.

### Apps cannot request a name variant

The Claude Design handoff proposed `name.legal` and `name.public` as separate
requestable scopes. **Rejected**, and this is the most important call in the
stretch.

In Persona an app requests `name` and declares a *purpose*; Persona resolves
purpose to variant, and the person can override on the consent screen. If a
clinic could simply ask for `name.legal`, the app would decide the context
rather than the context deciding — and the contextual-integrity argument the
whole project rests on collapses. The console says so inline: *"You ask for a
name, not a version of it."*

### Curated accent palette, not a colour picker

An app's accent renders as its monogram **on Persona's own consent screen** —
the exact surface where someone is making a trust decision. A free picker allows
a colour illegible against white, or one close enough to Persona's teal to read
as first-party. Six named colours, all clearing 4.5:1 against white.

Knock-on: Tiger Store's accent moved from `amber` to `rust`, because amber is
the sensitive-data channel and an app should not be able to borrow it.

### Integration snippets are runnable code

The design showed a hand-written URL with literal spaces in `scope`, which
breaks if copied. Percent-encoding the whole thing would be correct but
unreadable. The snippet now builds the query with `URLSearchParams`, which is
encoded correctly by construction, is copy-pasteable, and teaches the right
pattern — the same one the demo apps use.

### Three fully independent demo apps

The user chose no shared package: each of `demos/clinic`, `demos/forum` and
`demos/store` carries its own copy of about 120 lines of OAuth plumbing.

The duplication is deliberate and the READMEs say so — these exist to be *read*
as integration examples, and someone wiring Persona into their own product
should find the whole thing in one folder. It also keeps them honestly
independent, since three unrelated companies would not share a library. The
alternative (an `@persona/rp-kit` workspace package) was offered and declined.

Each app got its own visual identity so the three read as unrelated products:

| App | Artifact the design is built around | Name variant it receives |
|---|---|---|
| City Health Clinic | A paper intake record — perforated edge, dotted leaders, red medical-alert block | **Legal** |
| Hobbyist Forum | A message-board post with an identity rail | **Public** |
| Tiger Store | A shipping label with a CSS barcode | **Preferred** |

The forum's home screen lists, struck through, everything Persona could have
released that it never asked for. That contrast is the artefact the report wants.

### Scopes and payload side by side

The one console screen that breaks the app's `max-w-2xl` column. Justified
because toggling a scope and watching the JSON change *is* the product's
argument; splitting them across a scroll would lose it. Everything else stays in
the normal reading width.

---

## Bugs found while building

These are the war stories. Each was found by a test or by actually running the
thing, not by reading the code.

**Revoking the previous grant killed the in-flight request.** Re-consenting to an
app should invalidate the old grant. It didn't work: `Interaction` rows carry a
`grant_id`, so `revokeByGrantId` destroyed the very interaction that was doing
the revoking, and the decision returned 410. Fixed by excluding interactions —
an interaction is a request in progress, not a credential. Caught by a test
written specifically for the re-consent path.

**The seed was destructive on every container start.** It deleted and recreated
the demo user, which took her vault item IDs with her — and every standing
consent points at those IDs. So `docker compose restart api` silently
disconnected everyone from their own data, and made the headline "connections
survive a restart" claim false while the OIDC layer was working perfectly. Found
by actually restarting the container and reloading the clinic, which showed a
200 response with zero claims. The seed is now idempotent.

**Unknown scopes were silently dropped before validation could reject them.** A
normalisation step filtered the scope list against the catalogue *before* the
validator ran, so a bad scope became a no-op instead of a 400. It would have
reached the database and bricked the client at authorize time. Caught by a unit
test that expected a rejection and got a success.

**`AUTH_SECRET` mismatch made every client unreadable.** After moving to Docker,
the container seeded secrets with one key while the local test process used
another, so decryption threw and no client could load. Correct behaviour, but
the failure was opaque. There is now a shared root `.env`, a documented
requirement that the two agree, and a clear log line when decryption fails.

**The console's Scopes view scrolled the page sideways on a phone.** Grid items
default to `min-width: auto` and refuse to shrink below their content, so the
side-by-side layout overflowed and the level control was cut off. Fixed with
`min-w-0` on both grid children. Found by forcing a 390px viewport, not by
reading CSS.

**A pre-existing `setState`-after-unmount race in `useLoad`.** Not introduced
here, but every console page depends on that hook, so it was fixed while
passing: the loader now cancels on unmount.

---

## Divergences from the design handoff

The design was strong and most of it was kept. These were corrected because they
described a system that does not exist:

| Design said | Reality |
|---|---|
| `/oidc/authorize`, `/oidc/userinfo` | `/oidc/auth`, `/oidc/me` — verified against the discovery document |
| `client_secret` as a form parameter | Clients are registered `client_secret_basic`; a form parameter returns 401 |
| No PKCE in the authorize snippet | All three demo apps use it; the snippet now shows it |
| "Rotating invalidates the previous secret in 24 h" | Rotation is immediate |
| "While paused, existing connections stay valid" | A disabled client fails authorize, token and userinfo alike |
| `contact.email`, `health.basics`, `document.image`, `emergency.contacts` | The twelve real scopes, served from `/api/catalog` |
| `avatar` offered as a scope | Storable but deliberately unshareable |
| `username` absent | It exists, and both the forum and store require it |

The design also assumed a separate `developers.persona.app` shell with its own
top navigation; the console instead lives in the app's existing sidebar.

---

## Deliberately not built

- **Purpose is not editable after an app is created.** The API supports it, but
  changing purpose silently changes what every connected person receives, so it
  needs the same revoke-and-reask treatment as narrowing scopes. Left as an open
  decision rather than a quiet default.
- **No mobile or tablet design frames for the console.** The responsive
  behaviour was built by following the patterns the main app's mobile designs
  already establish, and checked at 390px.
- **No usability study.** Still outstanding from the Design chapter, and Chapter
  5 must continue to report it as planned rather than done.
- **`@custom-variant dark` was kept** even though the app is light-only.
  Removing it would let the `dark:` utilities inside the shadcn primitives fall
  back to `prefers-color-scheme` and half-activate for OS-dark users. The dead
  token block was removed; the variant stays as a guard.

---

## Verification as it stands

| Check | Result |
|---|---|
| Backend tests | 338 pass — 213 unit, 125 integration (was 126 in total) |
| Backend coverage | 96.6% of statements, 92.4% of branches (was never measured) |
| Web app tests | 206 pass, 90.4% of statements (was zero — no runner at all) |
| Demo app tests | 94 pass, 100% of the OAuth plumbing (was zero) |
| Backend `tsc`, and now the test files too | clean |
| Frontend build, lint, typecheck | clean |
| Full OAuth flow through Docker | clinic, forum and store all verified in a browser |
| Connection survives `docker compose restart api` | verified — this provably did not work before |
| Console at 390px | `scrollWidth === clientWidth`, no horizontal scroll |
| Spanish | every console string translated; a missing key is a compile error, and a key left in English now fails a test |

Test files worth naming in Chapter 5: `oidc-adapter.test.ts`, `secret-box.test.ts`,
`client.service.test.ts`, `scope-catalog.test.ts`, `apps.int.test.ts`, and
`apps-oauth.int.test.ts` — the last of which registers an app through the REST
API and then completes a real authorization-code flow against it, including
negative cases for scope escalation, tampered redirect URIs, wrong secrets,
disabled apps and post-consent scope narrowing.

---

## The testing stretch

Written 9 August 2026, after the console work. The suite that existed was good
where it reached, but nobody had ever measured it and it could not prove that.
Six things came out of looking properly.

### Coverage had never been measured, and the unit number was misleading

There was no `collectCoverageFrom`, no threshold, no merged report. Running the
unit suite alone reports **60% of statements**; running unit and integration
together reports **90%**. Neither number means much on its own — most of the OIDC
layer is only reachable through a real authorization flow, and most of the
validation logic is only reachable without one — so `jest.all.config.js` now runs
both as one job and reports them together. That merged figure is the only one
Chapter 5 should quote.

### The path that runs in production had no coverage at all

`tests/int.setup.js` sets `WEB_URL=''` so the suite exercises Persona's built-in
HTML pages. Docker sets `WEB_URL`. So every branch that hands the browser over to
the Next app — the path that actually runs — was never executed by a test. Fixed
with `tests/interactions-web.int.test.ts`, which rebuilds the module graph inside
`jest.isolateModulesAsync` with the variable set, because `config.ts` reads the
environment once at import.

This is a good example for the report of a coverage number hiding a gap rather
than revealing one: the line coverage looked fine because the *other* branch was
covered.

### A fake that no longer matched the thing it stood in for

`tests/oidc-adapter.test.ts` runs against a hand-written in-memory
`OidcPayloadRepository`. Its `find` did not filter expired rows; the real Prisma
one does. So the adapter's unit tests were passing against a store that behaves
differently from the store it uses in production.

The fix is more interesting than the bug: `oidc-payload.repository.int.test.ts`
now runs the same script of operations through both implementations and compares
every answer. The fake cannot drift again without failing.

### Bugs found by writing the tests

**A flaky assertion that had started failing.** The persistence test picked an
arbitrary `AuthorizationCode` row and asserted it had been consumed. `oidc_payload`
is never truncated between runs, so it was picking up an abandoned code from an
earlier test. Now scoped to the grant the test itself created.

**Impossible dates were accepted.** `DATE_PATTERN` is `/^\d{4}-\d{2}-\d{2}$/`,
which happily accepts `1998-13-01` and `1998-04-31`. Birth dates and document
issue dates both used it. Replaced with a check that parses the date and requires
it to round-trip back to the same string, which also rejects 29 February in a
common year.

**Nothing proved an unexpected error stays quiet.** The error handler's
`AppError` branch was exercised constantly; its 500 fallback never was. There is
now a test asserting that a thrown `Error` carrying a connection string produces
exactly `{"error":{"code":"INTERNAL_SERVER_ERROR",…}}` and that no part of the
message reaches the wire.

**No test ever sent a bad session cookie.** `verifyAuthToken`'s `catch → null` —
the whole session gate — was unreached. Now covered for a token signed with
another key, a token whose payload was swapped after signing, an expired token,
and a valid signature carrying no subject.

### The web app and the demos had no tests, and no runner either

Not "thin coverage" — no jest, no vitest, no test file, nothing in any lockfile,
across 6,725 lines of web app and 1,579 lines of demos. Vitest now runs in
`persona/web` and `demos/clinic`, in a Node environment with no DOM.

Getting there needed a real change: seven pure functions were living inside
`.tsx` files, so importing them pulled in React, `radix-ui` and `lucide-react`.
They moved to `src/lib` — `snapshotText` (what an app holds, as a person reads
it), `toPayloadLines` (the console's annotated JSON), `itemPayload` (the vault
form's per-kind shaping), the consent predicates, the scope diff, `pageTitle`,
and the scope selection helpers. The components kept their state and effects;
only the computation moved. Worth reporting as a case where testability and
layering pointed the same way.

Two tests there are worth naming:

- **`demos/clinic/src/lib/persona.test.ts`** checks `challengeFor` against the
  **RFC 7636 Appendix B** vector. That proves PKCE is the transform the
  specification defines, not merely something that round-trips.
- **`persona/web/src/lib/strings.test.ts`** compares the EN and ES tables key by
  key and flags any Spanish string still identical to its English original. The
  type system catches a *missing* key; it cannot catch one that was copied and
  never translated.

### Testing one demo instead of three

The three demos duplicate their OAuth plumbing on purpose — that decision is
recorded above. The cost is drift: a fix made in one copy and forgotten in the
others. `demos/clinic/src/lib/parity.test.ts` compares the function bodies of all
three `persona.ts` files (ignoring the config block and comments, which are meant
to differ) and asserts the three route handlers are byte-identical. Testing one
copy is now enough, and the duplication is enforced rather than hoped for.

### Deliberately still not covered

- **`src/index.ts`** — the process bootstrap: `app.listen`, the sweep interval,
  the fatal handler. Testing it would test Node.
- **`src/oidc/keys.ts`'s generate branch** — runs once, on a fresh clone.
- **`web/src/lib/useLoad.ts`** — a React hook; it needs a renderer, and jsdom plus
  Testing Library was ruled out for this stretch.
- **No end-to-end browser tests.** The acceptance suite drives the real HTTP and
  OAuth layers but not a real browser, so the UI is still verified by hand.
- **No CI.** There is no git remote, so a workflow file would never run.

### Two things fixed while passing

`npm run lint` had never worked in any of the three demos: the script was
declared and `eslint-config-next` was installed, but no `eslint.config.mjs`
existed, so it failed with "couldn't find eslint.config". All three now carry the
same config as the web app, and all three lint clean — nothing was hiding behind
the broken script.

The root `.gitignore` also had no rule for `.next/`, `coverage/` or
`*.tsbuildinfo`, so the demos' build output and the new coverage reports were on
course to be committed. Added. Nothing had been committed yet, so no history
needed rewriting.

## The evidence the report wants

One person, one vault, three purposes, nothing chosen by hand:

| App | Fields released | Name variant |
|---|---|---|
| City Health Clinic | 9 | Legal — Camila Andrea Rodríguez García |
| Hobbyist Forum | 2 | Public — Camila R. |
| Tiger Store | 5 | Preferred — Cami Rodríguez |

Screenshots still to capture: the clinic and forum home screens side by side,
the console's scope picker with the live payload, and the consent screen showing
a context-aware suggestion.

## Open questions for review

1. Should purpose be editable after creation, and if so with what warning?
2. Should a paused app keep existing tokens working, rather than failing them?
   The current behaviour is defensible but the word "pause" suggests otherwise.
3. Deleting an app cascades away its audit entries, so a person loses the record
   that it ever had their data. Correct, or should the log outlive the app?
