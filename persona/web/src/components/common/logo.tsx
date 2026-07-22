import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "size-[30px] rounded-[9px]", ring: "size-3 border-2" },
  md: { box: "size-[38px] rounded-[11px]", ring: "size-[15px] border-[2.5px]" },
  lg: { box: "size-[54px] rounded-2xl", ring: "size-[22px] border-[3px]" },
};

// The Persona mark: teal rounded square with a white ring.
export function Logo({ size = "md", className }: { size?: keyof typeof sizes; className?: string }) {
  const s = sizes[size];
  return (
    <div className={cn("bg-brand flex items-center justify-center shadow-sm", s.box, className)}>
      <div className={cn("rounded-full border-white", s.ring)} />
    </div>
  );
}
