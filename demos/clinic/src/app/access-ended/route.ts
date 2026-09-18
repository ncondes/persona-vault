import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, fetchClaims, persona } from "@/lib/persona";

// Where /home sends the person once Persona stops answering for their token.
// Asked again here, so a stray link cannot end a session that still works.
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!accessToken) return NextResponse.redirect(`${persona.appUrl}/`);

  if (await fetchClaims(accessToken)) {
    return NextResponse.redirect(`${persona.appUrl}/home`);
  }

  const response = NextResponse.redirect(`${persona.appUrl}/?error=access_ended`);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
