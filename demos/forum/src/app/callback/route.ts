import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  exchangeCode,
  persona,
  sameState,
} from "@/lib/persona";

function fail(reason: string) {
  return NextResponse.redirect(`${persona.appUrl}/?error=${encodeURIComponent(reason)}`);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("error")) {
    return fail(params.get("error") as string);
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  // An unverified state is how a login CSRF gets in, so bail rather than
  // guessing.
  if (!code || !state || !expectedState || !verifier || !sameState(state, expectedState)) {
    return fail("invalid_callback");
  }

  let accessToken: string;
  try {
    accessToken = await exchangeCode(code, verifier);
  } catch {
    return fail("token_exchange_failed");
  }

  const response = NextResponse.redirect(`${persona.appUrl}/home`);
  response.cookies.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(VERIFIER_COOKIE);
  return response;
}
