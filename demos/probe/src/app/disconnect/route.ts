import { NextResponse } from "next/server";
import { SESSION_COOKIE, persona } from "@/lib/persona";
import { SPENT_CODE_COOKIE } from "@/lib/attacks-session";

// Only clears this app's session. Revoking Persona's grant is done by the
// person, in Persona — which is check 10, and the difference between the two is
// the thing that check is testing.
export async function POST() {
  const response = NextResponse.redirect(persona.appUrl, { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(SPENT_CODE_COOKIE);
  return response;
}
