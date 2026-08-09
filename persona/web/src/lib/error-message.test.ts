import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { errorMessage } from "./error-message";
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
// reads. The rules that matter: a code we have translated always wins, and
// nothing the server wrote in English is ever shown to a Spanish reader.
describe("errorMessage", () => {
  it("falls back to the apology for anything that is not an ApiError", () => {
    expect(errorMessage(t, new Error("boom"))).toBe(t.common.somethingWrong);
    expect(errorMessage(t, "boom")).toBe(t.common.somethingWrong);
    expect(errorMessage(t, undefined)).toBe(t.common.somethingWrong);
  });

  it("prefers the translated sentence for an auth code", () => {
    const err = apiError(401, "OTP_EXPIRED");
    expect(errorMessage(t, err)).toBe(t.auth.errors.OTP_EXPIRED);
    expect(errorMessage(es, err)).toBe(es.auth.errors.OTP_EXPIRED);
  });

  it("prefers the translated sentence for a vault code", () => {
    const err = apiError(400, "SINGLE_VALUE_KIND");
    expect(errorMessage(t, err)).toBe(t.vault.errors.SINGLE_VALUE_KIND);
    expect(errorMessage(es, err)).toBe(es.vault.errors.SINGLE_VALUE_KIND);
  });

  it("shows the first field error when the code is not one we translate", () => {
    const err = apiError(400, "VALIDATION_ERROR", "Validation failed", {
      redirectUris: "Must be an absolute URL.",
      name: "Required.",
    });
    expect(errorMessage(t, err)).toBe("Must be an absolute URL.");
  });

  it("ignores an empty fields object and uses the server's sentence", () => {
    const err = apiError(400, "SOMETHING_ODD", "That app is paused.", {});
    expect(errorMessage(t, err)).toBe("That app is paused.");
  });

  it("shows the server's sentence for a 4xx with nothing better", () => {
    expect(errorMessage(t, apiError(409, "CONFLICT", "That name is taken."))).toBe(
      "That name is taken.",
    );
  });

  it("hides a 5xx sentence behind the apology", () => {
    const err = apiError(500, "INTERNAL", "Cannot read properties of undefined");
    expect(errorMessage(t, err)).toBe(t.common.somethingWrong);
  });

  it("hides the placeholder used when the body was not JSON", () => {
    const err = apiError(502, "UNKNOWN", "Request failed");
    expect(errorMessage(t, err)).toBe(t.common.somethingWrong);
    expect(errorMessage(es, apiError(400, "UNKNOWN", "Request failed"))).toBe(
      es.common.somethingWrong,
    );
  });
});
