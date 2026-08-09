import { NextResponse } from "next/server";
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  authorizeUrl,
  challengeFor,
  newState,
  newVerifier,
} from "@/lib/persona";

// Starts "Connect with Persona". The state and PKCE verifier are parked in
// short-lived cookies so the callback can prove this browser began the flow.
export async function GET() {
  const state = newState();
  const verifier = newVerifier();

  const response = NextResponse.redirect(authorizeUrl(state, challengeFor(verifier)));
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  response.cookies.set(STATE_COOKIE, state, options);
  response.cookies.set(VERIFIER_COOKIE, verifier, options);
  return response;
}
