import { formatClaim } from "@/lib/format";
import type { Claims } from "@/lib/persona";

// The intake record, blank before the patient connects and filled after. It is
// deliberately the same component in both states: the whole point of the demo
// is that nothing was typed in between.
const SECTIONS: Array<{ title: string; alert?: boolean; fields: Array<[string, string]> }> = [
  {
    title: "Patient",
    fields: [
      ["name", "Full name"],
      ["birth_date", "Date of birth"],
      ["document", "Identity document"],
    ],
  },
  {
    title: "Contact",
    fields: [
      ["email", "Email"],
      ["phone", "Phone"],
      ["address", "Home address"],
    ],
  },
  {
    title: "Medical alert",
    alert: true,
    fields: [
      ["blood_type", "Blood type"],
      ["eps", "Health insurer"],
      ["allergies", "Allergies"],
    ],
  },
];

function FieldRow({ label, value, alert }: { label: string; value: string | null; alert?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <span className="font-display w-32 shrink-0 text-[11px] font-600 tracking-[0.08em] text-ink-soft uppercase">
        {label}
      </span>
      <span className="leader min-w-0 flex-1 pb-1">
        {value ? (
          <span
            className={`font-data text-[13.5px] break-words ${
              alert ? "text-alert font-600" : "text-ink"
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="font-data text-[13.5px] text-rule">not shared</span>
        )}
      </span>
    </div>
  );
}

export function RecordCard({ claims }: { claims: Claims | null }) {
  const filled = claims !== null;

  return (
    <article className="perforated bg-card shadow-[0_1px_2px_rgba(15,33,28,0.06),0_12px_28px_-18px_rgba(15,33,28,0.35)]">
      <header className="border-b border-rule px-7 pt-8 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[10px] font-600 tracking-[0.18em] text-care uppercase">
              Form 01 · New patient intake
            </p>
            <h2 className="font-display mt-1.5 text-[22px] font-700 tracking-tight">
              Patient record
            </h2>
          </div>
          <span
            className={`font-display rounded-full px-2.5 py-1 text-[10px] font-600 tracking-[0.1em] uppercase ${
              filled ? "bg-care-soft text-care-deep" : "bg-paper text-ink-soft"
            }`}
          >
            {filled ? "Complete" : "Awaiting patient"}
          </span>
        </div>
      </header>

      <div className="px-7 pb-7">
        {SECTIONS.map((section) => (
          <section key={section.title} className="border-b border-rule py-4 last:border-b-0">
            <h3
              className={`font-display mb-1 text-[10px] font-600 tracking-[0.18em] uppercase ${
                section.alert ? "text-alert" : "text-ink-soft"
              }`}
            >
              {section.title}
            </h3>
            {section.fields.map(([scope, label]) => (
              <FieldRow
                key={scope}
                label={label}
                alert={section.alert}
                value={claims ? formatClaim(scope, claims[scope]) : null}
              />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
