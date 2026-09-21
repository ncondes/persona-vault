import { NextResponse } from "next/server";

// Domain verification. Persona hands the developer a token in the console and
// fetches this path to check the app really is served from the domain its
// redirect URIs point at.
//
// It proves control of the web server, and nothing more: Persona still has no
// way to know whether whoever runs this domain is really a clinic. What it
// closes is the cheaper attack — putting a trusted-looking name on the consent
// screen next to a domain you do not hold.
export async function GET() {
  const token = process.env.PERSONA_VERIFICATION_TOKEN;
  if (!token) {
    return new NextResponse("not configured", { status: 404 });
  }
  return new NextResponse(token, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
