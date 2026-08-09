import type { Claims } from "@/lib/persona";

export function Wordmark() {
  return (
    <div>
      <span className="font-display text-[19px] font-800 tracking-[-0.03em]">
        Tiger<span className="text-tiger">Store</span>
      </span>
      <div aria-hidden className="stripe mt-1 h-1.5 w-16 opacity-90" />
    </div>
  );
}

export function OrderSummary() {
  return (
    <div className="border-line rounded-2xl border p-5">
      <h2 className="font-display text-[13px] font-700 tracking-[0.08em] uppercase">Your basket</h2>
      <div className="border-line mt-4 flex items-center gap-4 border-b pb-4">
        <div
          aria-hidden
          className="bg-kraft border-line flex size-16 shrink-0 items-center justify-center rounded-xl border text-2xl"
        >
          🫖
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-600">Cast iron teapot, 0.6 L</p>
          <p className="text-ink-soft mt-0.5 text-[13px]">Nambu tekki · matte black</p>
        </div>
        <span className="font-data text-[14px]">$84.00</span>
      </div>
      <dl className="mt-4 space-y-1.5 text-[13.5px]">
        <div className="text-ink-soft flex justify-between">
          <dt>Shipping</dt>
          <dd className="font-data">$6.00</dd>
        </div>
        <div className="flex justify-between text-[15px] font-700">
          <dt>Total</dt>
          <dd className="font-data">$90.00</dd>
        </div>
      </dl>
    </div>
  );
}

// A parcel label. The dashed rule is the tear line, and the barcode is drawn,
// not an image, so it stays crisp at any size.
export function ShippingLabel({
  name,
  address,
  phone,
  email,
  handle,
}: {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  handle: string | null;
}) {
  return (
    <div className="border-ink rounded-xl border-2 bg-white">
      <div className="bg-ink flex items-center justify-between rounded-t-[0.4rem] px-5 py-2.5 text-white">
        <span className="font-data text-[11px] tracking-[0.18em]">TIGER STORE · GROUND</span>
        <span className="font-data text-[11px] tracking-[0.18em]">CO</span>
      </div>

      <div className="px-5 py-5">
        <p className="font-display text-ink-soft text-[10px] font-700 tracking-[0.2em] uppercase">
          Ship to
        </p>
        <p className="font-display mt-1.5 text-[20px] leading-tight font-800 tracking-[-0.02em]">
          {name ?? "—"}
        </p>
        <p className="font-data mt-2 text-[13.5px] leading-relaxed whitespace-pre-line">
          {address ?? "No address shared"}
        </p>

        <dl className="border-line mt-4 space-y-1 border-t pt-3 text-[12.5px]">
          <div className="flex gap-2">
            <dt className="text-ink-soft w-14 shrink-0">Phone</dt>
            <dd className="font-data">{phone ?? "not shared"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft w-14 shrink-0">Email</dt>
            <dd className="font-data break-all">{email ?? "not shared"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-soft w-14 shrink-0">Account</dt>
            <dd className="font-data">{handle ?? "guest"}</dd>
          </div>
        </dl>
      </div>

      <div aria-hidden className="border-line border-t border-dashed">
        <div className="px-5 py-4">
          <div className="barcode h-11 w-full opacity-90" />
          <p className="font-data mt-2 text-center text-[11px] tracking-[0.3em]">
            TGR 4413 0091 77
          </p>
        </div>
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

// Persona returns the address as an object; a label wants it as printed lines.
export function addressLines(claims: Claims): string | null {
  const address = claims.address;
  if (!isRecord(address)) return null;

  const lines = [
    str(address.line1),
    str(address.line2),
    str(address.line3),
    [str(address.city), str(address.postalCode)].filter(Boolean).join(" "),
    str(address.country),
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.length > 0 ? lines.join("\n") : str(address.formatted);
}

export const claimText = (claims: Claims, key: string): string | null => str(claims[key]);
