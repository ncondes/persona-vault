import type { Claims } from "@/lib/persona";

export function Masthead({ signedIn }: { signedIn?: React.ReactNode }) {
  return (
    <header className="chrome-bar text-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[17px] font-900 tracking-tight">Hobbyist Forum</span>
          <span className="font-data text-[11px] text-white/55">est. 2004</span>
        </div>
        {signedIn}
      </div>
      <nav className="border-t border-white/15 bg-black/10">
        <div className="font-data mx-auto flex max-w-4xl gap-5 px-5 py-1.5 text-[11px] tracking-wide text-white/70">
          <span className="text-white">Boards</span>
          <span>Unread</span>
          <span>Members</span>
          <span>Search</span>
        </div>
      </nav>
    </header>
  );
}

export function Panel({ title, right, children }: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line overflow-hidden rounded-[3px] border">
      <div className="chrome-bar flex items-center justify-between gap-3 px-4 py-2 text-white">
        <h2 className="font-display text-[12px] font-700 tracking-[0.1em] uppercase">{title}</h2>
        {right}
      </div>
      <div className="bg-card">{children}</div>
    </section>
  );
}

// A board post: identity rail on the left, body on the right. The rail is the
// only place a forum ever needed identity, which is the point of the demo.
export function Post({
  handle,
  displayName,
  postNumber,
  joined,
  children,
  footer,
}: {
  handle: string;
  displayName: string;
  postNumber: number;
  joined: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <article className="border-line grid gap-0 border-b last:border-b-0 sm:grid-cols-[168px_1fr]">
      <div className="border-line bg-board/60 flex items-center gap-3 border-b px-4 py-4 sm:block sm:border-r sm:border-b-0">
        <div className="bg-chrome font-display flex size-11 items-center justify-center rounded-[3px] text-[15px] font-700 text-white sm:size-14 sm:text-[19px]">
          {initials}
        </div>
        <div className="sm:mt-2.5">
          <p className="font-data text-chrome text-[13px] font-500 break-all">{handle}</p>
          <p className="text-ink-soft mt-0.5 text-[11px]">{displayName}</p>
          <dl className="text-ink-soft mt-2 hidden text-[11px] sm:block">
            <div className="flex justify-between gap-2">
              <dt>Joined</dt>
              <dd className="font-data">{joined}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Posts</dt>
              <dd className="font-data">1</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-ink-soft font-data mb-2.5 text-[11px]">#{postNumber}</p>
        <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
        {footer ? (
          <div className="border-line text-ink-soft mt-5 border-t pt-3 text-[12px]">{footer}</div>
        ) : null}
      </div>
    </article>
  );
}

export function handleOf(claims: Claims): string {
  return typeof claims.username === "string" ? claims.username : "member";
}

export function displayNameOf(claims: Claims): string {
  return typeof claims.name === "string" ? claims.name : "New member";
}
