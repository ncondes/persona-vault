"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
}

// The right-hand section list. It highlights the last section whose heading has
// scrolled past the top of the viewport, so the reader always knows where they
// are. Section tops increase down the page, so the first one still below the
// line ends the scan.
export function TableOfContents({ items, label }: { items: TocItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const OFFSET = 120;
    let queued = false;

    const update = () => {
      queued = false;
      let current = items[0]?.id;
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top > OFFSET) break;
        current = id;
      }
      if (current) setActive(current);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  return (
    <nav aria-label={label} className="text-sm">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <ul className="border-l border-foreground/10">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-3 transition-colors",
                item.id === active
                  ? "border-brand font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
