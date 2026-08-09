import { NextResponse } from "next/server";
import { SESSION_COOKIE, persona } from "@/lib/persona";

// Only clears this app's session. Revoking Persona's grant is done by the
// person, in Persona.
export async function POST() {
  const response = NextResponse.redirect(persona.appUrl, { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
