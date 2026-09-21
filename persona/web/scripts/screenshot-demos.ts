import { resolve } from "node:path";
import { chromium, type Page } from "playwright-core";

// Captures the two figures that are taken from a relying party's side rather
// than Persona's: the clinic's patient record after a field was withheld, and
// Probe's attack console.
//
// Both need a real connection, so this drives the whole flow -- sign in, reach
// the consent screen, decide, and follow the redirect back -- rather than
// visiting a URL. They are the two screenshots `screenshot.ts` cannot take,
// which is why they sat at 149 and 188 DPI while the rest were re-captured.
//
//   npx tsx scripts/screenshot-demos.ts <clinic|probe> <out.jpg>
//
// Defaults to the deployed copy, where the demos answer on their own domains
// and the consent screen names one it actually proved.
const PERSONA = process.env.SHOT_PERSONA_URL ?? "https://persona-id.up.railway.app";
const CLINIC = process.env.SHOT_CLINIC_URL ?? "https://city-health-clinic.up.railway.app";
const PROBE = process.env.SHOT_PROBE_URL ?? "https://persona-probe.up.railway.app";
const EMAIL = process.env.SHOT_EMAIL ?? "camila@example.com";
const SCALE = Number(process.env.SHOT_SCALE ?? 3);

const [target = "clinic", output = "shot.jpg"] = process.argv.slice(2);

// The demo panel on Persona's sign-in screen: one click, no password, limited
// to the seeded accounts. It is how the hosted copy is usable at all, since the
// seeded addresses are @example.com and no provider will deliver to them.
async function signIn(page: Page): Promise<void> {
  const demo = page.getByRole("button", { name: new RegExp(EMAIL.split("@")[0], "i") });
  if (await demo.count()) {
    await demo.first().click();
    await page.waitForLoadState("networkidle");
  }
}

async function decide(page: Page, withhold?: string): Promise<void> {
  // The consent screen fetches its fields after the page loads, so the toggles
  // are not in the DOM the moment the navigation settles.
  await page.waitForSelector('[role="switch"]', { timeout: 20_000 });

  if (withhold) {
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

  await page.getByRole("button", { name: /Share this data/i }).first().click();

  // Sensitive fields put a confirmation in the way, and it takes a moment to
  // appear -- long enough that a fixed wait clicked the page's own button a
  // second time instead. Wait for the dialog itself, and scope the click to it.
  const dialog = page.locator('[role="dialog"]');
  try {
    await dialog.waitFor({ state: "visible", timeout: 5_000 });
    await dialog.getByRole("button", { name: /Share this data/i }).click();
  } catch {
    // No confirmation step: nothing sensitive was being released.
  }
  await page.waitForURL((url) => !url.href.includes("/authorize/"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1492, height: Number(process.env.SHOT_HEIGHT ?? 812) },
      deviceScaleFactor: SCALE,
    });
    const page = await context.newPage();

    const app = target === "probe" ? PROBE : CLINIC;
    await page.goto(app, { waitUntil: "networkidle" });

    // Each demo words its own call to action -- "Fill this from Persona" at the
    // clinic, "connect" at Probe -- so match on the product name rather than on
    // a phrase any of them happens to use.
    await page
      .getByRole("link", { name: /Persona|connect/i })
      .or(page.getByRole("button", { name: /Persona|connect/i }))
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    if (page.url().startsWith(PERSONA)) {
      await signIn(page);
      if (page.url().includes("/authorize/")) {
        await decide(page, target === "clinic" ? "Address" : undefined);
      }
    }

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

    if (page.url().startsWith(PERSONA)) {
      throw new Error(`never left Persona; ended at ${page.url()}`);
    }

    const out = resolve(process.cwd(), output);
    await page.screenshot({ path: out, type: "jpeg", quality: 90 });
    console.log(`captured ${target} at ${page.url()} to ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
