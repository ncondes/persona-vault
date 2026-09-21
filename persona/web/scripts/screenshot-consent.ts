import { resolve } from "node:path";
import { chromium } from "playwright-core";

// Captures a consent screen for the report. Unlike screenshot.ts it has to walk
// the authorization flow first, because a consent screen only exists inside one:
// there is no URL that renders it on its own.
//
//   npx tsx scripts/screenshot-consent.ts <clientId> <scope> <output.jpg> [redirectUri] [withhold]
//
// `withhold` is the label of one optional field to switch off before the shot,
// for the figure that shows minimisation actually happening. Pass the literal
// `confirm` instead to press Share and capture the extra step that sensitive
// fields put in the way.
//
// It stops at the consent screen and never approves, so the relying party never
// has to be reachable — only Persona does.
const WEB = process.env.PERF_WEB_URL ?? "http://localhost:4420";
const API = process.env.PERF_API_URL ?? "http://localhost:4400";
const EMAIL = process.env.SHOT_EMAIL ?? "camila@example.com";

const [clientId = "clinic", scope = "openid name email", output = "consent.jpg", redirect, withhold] =
  process.argv.slice(2);

async function sessionCookies(): Promise<{ name: string; value: string }[]> {
  const jar: { name: string; value: string }[] = [];
  const collect = (res: Response): void => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      jar.push({ name: pair.slice(0, index).trim(), value: pair.slice(index + 1).trim() });
    }
  };

  const started = await fetch(`${API}/api/auth/dev/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  collect(started);
  const challenge = await started.json();

  const verified = await fetch(`${API}/api/auth/login/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: jar.map((c) => `${c.name}=${c.value}`).join("; "),
    },
    body: JSON.stringify({ challengeId: challenge.data.challengeId, code: challenge.data.code }),
  });
  if (!verified.ok) throw new Error(`login failed for ${EMAIL}: ${verified.status}`);
  collect(verified);
  return jar;
}

function redirectUri(): string {
  if (redirect) return redirect;
  const ports: Record<string, number> = { clinic: 4411, forum: 4412, store: 4413, probe: 4414 };
  return `http://localhost:${ports[clientId] ?? 4411}/callback`;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1492, height: Number(process.env.SHOT_HEIGHT ?? 812) },
      deviceScaleFactor: Number(process.env.SHOT_SCALE ?? 3),
    });
    await context.addCookies(
      (await sessionCookies()).map((c) => ({ ...c, domain: "localhost", path: "/" })),
    );

    const page = await context.newPage();
    const authorize = new URL(`${WEB}/oidc/auth`);
    authorize.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      scope,
      redirect_uri: redirectUri(),
      state: "shot",
      prompt: "consent",
    }).toString();

    await page.goto(authorize.toString(), { waitUntil: "networkidle" });
    if (!page.url().includes("/authorize/")) {
      throw new Error(`never reached a consent screen; ended at ${page.url()}`);
    }

    if (withhold === "confirm") {
      // The friction the design puts in front of sensitive data: pressing Share
      // opens a second screen naming exactly what is about to go.
      await page.getByRole("button", { name: /Share this data/i }).click();
      await page.waitForTimeout(500);
    } else if (withhold) {
      // Each optional field is a card with a label and one switch. Find the
      // switch whose own card mentions the label, so the shot does not depend
      // on where the field sits in the list.
      const clicked = await page.evaluate((label: string) => {
        for (const toggle of Array.from(document.querySelectorAll('[role="switch"]'))) {
          const card = toggle.closest("div")?.parentElement;
          if (card?.textContent?.includes(label)) {
            (toggle as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, withhold);
      if (!clicked) throw new Error(`no switch found for "${withhold}"`);
      await page.waitForTimeout(400);
    }

    const target = resolve(process.cwd(), output);
    await page.screenshot({ path: target, type: "jpeg", quality: 90 });
    console.log(`captured consent for ${clientId} to ${target}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
