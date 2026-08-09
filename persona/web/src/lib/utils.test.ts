import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// `cn` is one line over clsx and tailwind-merge, but every component leans on it
// for conditional classes. These pin the two behaviours the components rely on:
// falsy values disappear, and a later Tailwind class beats an earlier one.
describe("cn", () => {
  it("joins class names", () => {
    expect(cn("rounded-xl", "border")).toBe("rounded-xl border");
  });

  it.each([
    [undefined],
    [null],
    [false],
    [""],
  ])("drops %o instead of rendering it", (falsy) => {
    expect(cn("border", falsy as never)).toBe("border");
  });

  it("keeps the class from a satisfied condition", () => {
    expect(cn("border", true && "ring-3")).toBe("border ring-3");
  });

  // Without the merge, a component's own padding could not override a default.
  it("lets a later Tailwind class win over a conflicting earlier one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm text-zinc-500", "text-zinc-900")).toBe("text-sm text-zinc-900");
  });

  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
  });
});
