import { resolve } from "node:path";
import { chromium } from "playwright-core";

// Captures a signed-in screen for the report. Figures are 1492x812 so a new one
// sits beside the hand-taken ones without rescaling.
//   npx tsx scripts/screenshot.ts <path> <output.jpg> [email]
const WEB = process.env.PERF_WEB_URL ?? "http://localhost:4420";
const API = process.env.PERF_API_URL ?? "http://localhost:4400";

const [path = "/console", output = "shot.jpg", email = "dev@example.com"] = process.argv.slice(2);

// Development-only sign-in endpoint: an email, a returned code, no password.
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
    body: JSON.stringify({ email }),
  });
  collect(started);
  const challenge = await started.json();

  const verified = await fetch(`${API}/api/auth/login/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
    body: JSON.stringify({ challengeId: challenge.data.challengeId, code: challenge.data.code }),
  });
  if (!verified.ok) throw new Error(`login failed for ${email}: ${verified.status}`);
  collect(verified);
  return jar;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1492, height: Number(process.env.SHOT_HEIGHT ?? 812) },
      deviceScaleFactor: 2,
    });
    const cookies = (await sessionCookies()).map((cookie) => ({
      ...cookie,
      domain: "localhost",
      path: "/",
    }));
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
    const target = resolve(process.cwd(), output);
    await page.screenshot({ path: target, type: "jpeg", quality: 90 });
    console.log(`captured ${path} as ${email} to ${target}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
