import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { errorMessage, fieldMessages } from "./error-message";
import { getStrings } from "./strings";

const t = getStrings("en");
const es = getStrings("es");

const apiError = (
  status: number,
  code: string,
  message = "Request failed",
  fields?: Record<string, string>,
) => new ApiError(status, code, message, fields);

// Every failed mutation ends up here, so this is what the person actually
// reads. The rule that matters most: nothing the server wrote in English ever
// reaches the screen, in either language.
describe("errorMessage", () => {
  it("falls back to the apology for anything that is not an ApiError", () => {
    expect(errorMessage(t, new Error("boom"))).toBe(t.common.somethingWrong);
    expect(errorMessage(t, "boom")).toBe(t.common.somethingWrong);
    expect(errorMessage(t, undefined)).toBe(t.common.somethingWrong);
  });

  it("translates an error code", () => {
    const err = apiError(401, "OTP_EXPIRED");
    expect(errorMessage(t, err)).toBe(t.errors.codes.OTP_EXPIRED);
    expect(errorMessage(es, err)).toBe(es.errors.codes.OTP_EXPIRED);
  });

  // A 502 that we have wording for: the code table is consulted before any
  // status-based apology, so the specific sentence still wins.
  it("translates a code that came back with a server status", () => {
    const err = apiError(502, "EMAIL_SEND_FAILED");
    expect(errorMessage(t, err)).toBe(t.errors.codes.EMAIL_SEND_FAILED);
    expect(errorMessage(es, err)).toBe(es.errors.codes.EMAIL_SEND_FAILED);
  });

  // The specific problem beats the general one: VALIDATION_ERROR has its own
  // sentence, but "Add at least one." says more.
  it("prefers a field problem over the error code", () => {
    const err = apiError(400, "VALIDATION_ERROR", "Validation failed", {
      redirectUris: "EMPTY_LIST",
    });
    expect(errorMessage(t, err)).toBe(t.errors.fields.EMPTY_LIST);
    expect(errorMessage(es, err)).toBe(es.errors.fields.EMPTY_LIST);
  });

  it("falls back to the code when no field carries one we know", () => {
    const err = apiError(400, "VALIDATION_ERROR", "Validation failed", {});
    expect(errorMessage(t, err)).toBe(t.errors.codes.VALIDATION_ERROR);
  });

  it("never shows the sentence the server sent", () => {
    expect(errorMessage(t, apiError(409, "SOMETHING_ODD", "That app is paused."))).toBe(
      t.common.somethingWrong,
    );
    expect(errorMessage(t, apiError(500, "INTERNAL", "Cannot read properties of undefined"))).toBe(
      t.common.somethingWrong,
    );
    expect(errorMessage(es, apiError(502, "UNKNOWN", "Request failed"))).toBe(
      es.common.somethingWrong,
    );
  });
});

describe("fieldMessages", () => {
  it("has nothing to say about a missing or empty map", () => {
    expect(fieldMessages(t, undefined)).toEqual({});
    expect(fieldMessages(t, {})).toEqual({});
  });

  it("translates every field it recognises, in both languages", () => {
    const fields = { name: "REQUIRED", description: "TOO_LONG" };

    expect(fieldMessages(t, fields)).toEqual({
      name: t.errors.fields.REQUIRED,
      description: t.errors.fields.TOO_LONG,
    });
    expect(fieldMessages(es, fields)).toEqual({
      name: es.errors.fields.REQUIRED,
      description: es.errors.fields.TOO_LONG,
    });
  });

  // The form asks for `redirectUris`; the server answers about `redirectUris.0`.
  it("files a nested problem under its root as well as its full path", () => {
    expect(fieldMessages(t, { "redirectUris.0": "INVALID_URL" })).toEqual({
      "redirectUris.0": t.errors.fields.INVALID_URL,
      redirectUris: t.errors.fields.INVALID_URL,
    });
  });

  // Two bad URIs are one problem to the person filling the form, and the first
  // one is the one they will look at.
  it("keeps the first message when two paths share a root", () => {
    const messages = fieldMessages(t, {
      "redirectUris.0": "INVALID_URL",
      "redirectUris.1": "URL_HAS_FRAGMENT",
    });
    expect(messages.redirectUris).toBe(t.errors.fields.INVALID_URL);
  });

  // MISSING_FIELDS puts a list of scopes in `fields`; a scope list is data the
  // consent screen acts on, not something to read out.
  it("drops a value that is not a code we translate", () => {
    expect(fieldMessages(t, { scopes: "email phone" })).toEqual({});
  });
});
