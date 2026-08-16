# Probe — the adversarial relying party

The fourth demo app. The clinic, forum and store show what Persona does when
everyone behaves; Probe is what happens when a registered client turns hostile.

It exists because a marker asked how malicious clients would be simulated. The
honest answer is: register one, point it at the real provider, and publish what
comes back.

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:4414
```

Needs Persona on `:4400` and its web app on `:4420`, and the seed to have run —
Probe is registered by `persona/src/constants/clients.ts` like the other three.

## What it is

Registered as a **social app wanting a name and a handle**. That is all it
declared, and it is deliberately modest, because everything it then reaches for
is outside that list:

| Registered | Goes after |
|---|---|
| `name`, `username` | `document`, `blood_type`, `allergies`, other people's vaults, tokens it should not hold |

Connect it, and the consent screen offers **Camila R. · Public** — the public
name, because Probe said it was a social app. It never sees the legal one.

## The ten checks

Each runs over HTTP against the real provider. Nothing is stubbed, and nothing
is scored by reading Persona's source.

1. Ask for data it never registered
2. Send the code somewhere else
3. Use the token endpoint without the secret
4. Invent an access token
5. Read the vault directly with an OAuth token
6. Erase the evidence
7. Widen the grant at the token endpoint
8. Read what the person declined
9. Spend the same code twice
10. Keep using a revoked token

**Current result: 10 attempted, 0 succeeded.**

## Three states, not two

A check reports **blocked** only when the defence demonstrably held. If it could
not tell — not connected, network error, or a precondition the person has not
performed — it reports **inconclusive** in amber and is never allowed to read as
a pass. An evaluation that grades itself generously is worth nothing.

**Got through** is red, and it means a real defect in Persona. It belongs in the
evaluation chapter as a finding, not quietly dropped.

## Two need a person

- **Revocation** (check 10) — revoke Probe in Persona, reload, and watch it turn
  from inconclusive to blocked.
- **Code replay** (check 9) — sits behind its own button, because a correct
  provider treats code reuse as evidence of theft and drops the whole grant. It
  logs Probe out, which is the right behaviour.

## It is not a broken client

Probe's `src/lib/persona.ts` is byte-for-byte the same plumbing as the honest
demos — correct PKCE, a checked `state`, the lot. `src/lib/parity.test.ts`
enforces that, and the point is not decoration: if Probe's OAuth were merely
wrong, every refusal could be explained away as Probe getting the protocol
wrong, and the whole exercise would prove nothing.

Everything hostile lives in `src/lib/attacks.ts`. The one deviation in the
callback — keeping the code it spent, so the replay check has a real one to
offer back — is asserted in the parity test rather than left to be noticed.

## Also pinned in CI

`persona/tests/security.int.test.ts` runs the same ten checks plus two more (a
disabled app cannot authorize; a wrong PKCE verifier is refused) on every
change, so what this console demonstrates once cannot quietly stop being true.
