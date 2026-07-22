import Link from "next/link";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "size-[30px] rounded-[9px]", ring: "size-3 border-2" },
  md: { box: "size-[38px] rounded-[11px]", ring: "size-[15px] border-[2.5px]" },
  lg: { box: "size-[54px] rounded-2xl", ring: "size-[22px] border-[3px]" },
};

// brand: teal square on light backgrounds; light: white square for dark ones.
const tones = {
  brand: { box: "bg-brand", ring: "border-white" },
  light: { box: "bg-white", ring: "border-brand" },
};

// The Persona mark: a rounded square with a contrasting ring. Pass `href` to
// turn it into a home link.
export function Logo({
  size = "md",
  tone = "brand",
  href,
  className,
}: {
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  href?: string;
  className?: string;
}) {
  const s = sizes[size];
  const c = tones[tone];

  if (href) {
    return (
      <Link
        href={href}
        aria-label="Persona"
        className={cn(
          "inline-flex w-fit transition-transform hover:scale-105 active:scale-95",
          className,
        )}
      >
        <span className={cn("flex items-center justify-center shadow-sm", c.box, s.box)}>
          <span className={cn("block rounded-full", c.ring, s.ring)} />
        </span>
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center justify-center shadow-sm", c.box, s.box, className)}>
      <div className={cn("rounded-full", c.ring, s.ring)} />
    </div>
  );
}
