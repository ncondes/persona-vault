import { describe, expect, it } from "vitest";
import { diffScopes, selectionFrom, selectionToScopes, type ScopeSelection } from "./scope-selection";
import type { AppView } from "./types";

const app = (allowed: string[], required: string[] = []) =>
  ({ allowedScopes: allowed, requiredScopes: required }) as AppView;

describe("selectionFrom", () => {
  it("marks the required scopes and leaves the rest optional", () => {
    expect(selectionFrom(["name", "email", "phone"], ["name"])).toEqual({
      name: "required",
      email: "optional",
      phone: "optional",
    });
  });

  it("returns nothing for an app that asks for nothing", () => {
    expect(selectionFrom([], [])).toEqual({});
  });

  // The picker can only show scopes the app allows, so a required scope missing
  // from the allowed list has nowhere to appear. The server rejects that
  // combination on save; the picker simply never builds it.
  it("drops a required scope that is not also allowed", () => {
    expect(selectionFrom(["email"], ["name"])).toEqual({ email: "optional" });
  });
});

describe("selectionToScopes", () => {
  it("splits the selection back into the two lists the API takes", () => {
    const selection: ScopeSelection = { name: "required", email: "optional" };

    expect(selectionToScopes(selection)).toEqual({
      allowedScopes: ["name", "email"],
      requiredScopes: ["name"],
    });
  });

  it("round-trips a well-formed selection unchanged", () => {
    const allowed = ["name", "email", "phone"];
    const required = ["name", "phone"];

    const back = selectionToScopes(selectionFrom(allowed, required));

    expect(back.allowedScopes.sort()).toEqual(allowed.sort());
    expect(back.requiredScopes.sort()).toEqual(required.sort());
  });

  it("keeps every required scope inside the allowed list", () => {
    const { allowedScopes, requiredScopes } = selectionToScopes({
      name: "required",
      email: "required",
    });

    for (const scope of requiredScopes) {
      expect(allowedScopes).toContain(scope);
    }
  });
});

describe("diffScopes", () => {
  const saved = app(["name", "email"], ["name"]);

  it("sees no change when the same scopes come back in another order", () => {
    expect(diffScopes(saved, { allowedScopes: ["email", "name"], requiredScopes: ["name"] })).toEqual(
      { dirty: false, removes: false },
    );
  });

  it("notices a scope being added", () => {
    expect(
      diffScopes(saved, { allowedScopes: ["name", "email", "phone"], requiredScopes: ["name"] }),
    ).toEqual({ dirty: true, removes: false });
  });

  // Narrowing revokes every standing consent server-side, so the console has to
  // know the difference and ask first.
  it("notices a scope being taken away", () => {
    expect(diffScopes(saved, { allowedScopes: ["name"], requiredScopes: ["name"] })).toEqual({
      dirty: true,
      removes: true,
    });
  });

  it("counts a change of level as dirty, but not as narrowing", () => {
    expect(
      diffScopes(saved, { allowedScopes: ["name", "email"], requiredScopes: ["name", "email"] }),
    ).toEqual({ dirty: true, removes: false });
  });

  it("treats swapping one scope for another as narrowing", () => {
    expect(
      diffScopes(saved, { allowedScopes: ["name", "phone"], requiredScopes: ["name"] }),
    ).toEqual({ dirty: true, removes: true });
  });

  it("treats clearing everything as narrowing", () => {
    expect(diffScopes(saved, { allowedScopes: [], requiredScopes: [] })).toEqual({
      dirty: true,
      removes: true,
    });
  });
});
