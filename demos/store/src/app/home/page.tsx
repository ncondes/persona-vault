import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OrderSummary,
  ShippingLabel,
  Wordmark,
  addressLines,
  claimText,
} from "@/components/store";
import { SESSION_COOKIE, fetchClaims, persona } from "@/lib/persona";

export default async function HomePage() {
  const store = await cookies();
  const accessToken = store.get(SESSION_COOKIE)?.value;
  if (!accessToken) redirect("/");

  // Re-read on every load, so an address changed in Persona reaches the next
  // order without anyone updating a profile here.
  const claims = await fetchClaims(accessToken);
  if (!claims) redirect("/access-ended");

  const handle = claimText(claims, "username");
  const address = addressLines(claims);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="font-data text-ink-soft text-[13px]">{handle ?? "guest"}</span>
          <form action="/disconnect" method="post">
            <button
              type="submit"
              className="border-line hover:bg-kraft font-display rounded-full border px-4 py-1.5 text-[13px] font-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-10">
        <span className="bg-ship/10 text-ship font-data inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] tracking-wide">
          <span aria-hidden>●</span> Ready to ship
        </span>
        <h1 className="font-display mt-3 max-w-[18ch] text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1] font-800 tracking-[-0.03em]">
          Order confirmed. You typed nothing.
        </h1>
        <p className="text-ink-soft mt-4 max-w-[50ch] text-[15px] leading-relaxed">
          {address
            ? "Your label is printed below, straight from the details you approved."
            : "You did not share an address, so this order is on hold until you add one."}
        </p>
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="order-2 lg:order-1">
          <OrderSummary />
          <p className="text-ink-soft mt-5 text-[13px] leading-relaxed">
            Tiger Store keeps no copy of your address. It is read from your Persona vault at
            checkout, which means moving house is one edit in{" "}
            <a
              className="text-tiger-deep underline underline-offset-2"
              href={`${persona.webUrl}/vault`}
            >
              your vault
            </a>
            , not five emails to five shops.
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <ShippingLabel
            name={claimText(claims, "name")}
            address={address}
            phone={claimText(claims, "phone")}
            email={claimText(claims, "email")}
            handle={handle}
          />
        </div>
      </div>
    </main>
  );
}
