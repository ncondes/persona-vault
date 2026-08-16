import type { Locale } from "@/lib/strings";

// Generic, runnable code samples. They are language-neutral, so they live once
// here and are shared by both locales — only the prose around them is
// translated. Real endpoints (/oidc/auth, /oidc/token, /oidc/me) and the real
// PKCE + client_secret_basic flow, matching demos/clinic/src/lib/persona.ts.
export const DOCS_CODE = {
  env: `# From the Persona developer console (Register an app).
PERSONA_CLIENT_ID=your-client-id
PERSONA_CLIENT_SECRET=your-client-secret

# Where the browser is sent, and where your server calls Persona.
# On one machine these are the same; under Docker they differ.
PERSONA_PUBLIC_URL=http://localhost:4400     # browser-facing
PERSONA_INTERNAL_URL=http://localhost:4400   # server-to-server

# Your app. redirect_uri is APP_URL + /callback, and must match
# one of the redirect URIs you registered.
APP_URL=http://localhost:3000`,

  authorize: `import crypto from "node:crypto";

// Ask only for what your app needs. openid is always first.
const SCOPE = "openid name email";

// Send the person to Persona to approve.
app.get("/connect", (req, res) => {
  const state = crypto.randomBytes(16).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  // Keep state + verifier for the callback. Short-lived, httpOnly.
  const opts = { httpOnly: true, sameSite: "lax", maxAge: 600_000 };
  res.cookie("persona_state", state, opts);
  res.cookie("persona_verifier", verifier, opts);

  const params = new URLSearchParams({
    client_id: process.env.PERSONA_CLIENT_ID,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: \`\${process.env.APP_URL}/callback\`,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(\`\${process.env.PERSONA_PUBLIC_URL}/oidc/auth?\${params}\`);
});`,

  callback: `import crypto from "node:crypto";

// Persona sends the person back here with a one-time code.
app.get("/callback", async (req, res) => {
  // The person can decline: Persona then returns error=access_denied.
  if (req.query.error) return res.redirect("/?error=" + req.query.error);

  const { code, state } = req.query;
  const expected = req.cookies.persona_state;
  const verifier = req.cookies.persona_verifier;

  // Only continue if this is the request we started. Constant-time compare.
  const ok =
    code && state && expected &&
    state.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!ok) return res.status(400).send("invalid callback");

  // Exchange the code for a token. Server-side only — the secret never
  // touches the browser. Auth is HTTP Basic (client_secret_basic).
  const creds = Buffer.from(
    \`\${process.env.PERSONA_CLIENT_ID}:\${process.env.PERSONA_CLIENT_SECRET}\`,
  ).toString("base64");

  const tokenRes = await fetch(\`\${process.env.PERSONA_INTERNAL_URL}/oidc/token\`, {
    method: "POST",
    headers: {
      authorization: \`Basic \${creds}\`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: \`\${process.env.APP_URL}/callback\`,
      code_verifier: verifier,
    }),
  });

  // A failed exchange still returns JSON, so check before reading the token.
  if (!tokenRes.ok) return res.status(502).send("token exchange failed");
  const { access_token } = await tokenRes.json();

  res.clearCookie("persona_state");
  res.clearCookie("persona_verifier");
  res.cookie("session", access_token, { httpOnly: true, sameSite: "lax", maxAge: 3_600_000 });
  res.redirect("/home");
});`,

  userinfo: `// Read the approved fields. Call it when you actually need them —
// this is the read Persona records in the person's audit log, and it
// reflects edits or withdrawals immediately.
async function fetchClaims(accessToken) {
  const res = await fetch(\`\${process.env.PERSONA_INTERNAL_URL}/oidc/me\`, {
    headers: { authorization: \`Bearer \${accessToken}\` },
  });
  if (!res.ok) return null;              // token expired, revoked, or app paused
  return res.json();                     // sub, plus the scopes they approved
}

app.get("/home", async (req, res) => {
  const claims = await fetchClaims(req.cookies.session);
  if (!claims) return res.redirect("/connect");   // no refresh token: start over

  // claims.sub is the only field always there. Key your own records on it.
  await db.users.upsert({ personaId: claims.sub });

  res.send(\`Hi \${claims.name ?? "there"} — \${claims.email ?? "no email shared"}\`);
});`,

  react: `// "Connect with Persona" is just a link to your own /connect route.
function ConnectButton() {
  return <a href="/connect" className="btn">Continue with Persona</a>;
}

// Once the callback has stored the session, show what the person shared.
// A field the person declined is simply absent — plan for that.
function Profile({ claims }) {
  if (!claims) return <ConnectButton />;
  return (
    <dl>
      <dt>Name</dt><dd>{claims.name ?? "Not shared"}</dd>
      <dt>Email</dt><dd>{claims.email ?? "Not shared"}</dd>
    </dl>
  );
}`,
} as const;

export type DocsCodeKey = keyof typeof DOCS_CODE;

// The purpose an app declares decides which name variant Persona suggests. The
// person can still override it on the consent screen. Kept as enum pairs so the
// labels can be pulled from the shared string catalogue per locale.
export const PURPOSE_VARIANTS: { purpose: string; variant: string }[] = [
  { purpose: "healthcare", variant: "legal" },
  { purpose: "government", variant: "legal" },
  { purpose: "finance", variant: "legal" },
  { purpose: "employment", variant: "professional" },
  { purpose: "education", variant: "professional" },
  { purpose: "social", variant: "public" },
  { purpose: "retail", variant: "preferred" },
  { purpose: "other", variant: "preferred" },
];

// The twelve data scopes, in catalog order. Rendered as chips under their own
// literal names — openid is not one of them, and is mentioned in the prose.
export const DATA_SCOPES = [
  "name",
  "given_name",
  "family_name",
  "username",
  "email",
  "phone",
  "address",
  "birth_date",
  "document",
  "blood_type",
  "eps",
  "allergies",
] as const;

// The next-steps links. hrefs are shared; only the labels/notes are translated
// (matched to the arrays below by index).
export const NEXT_LINKS = [
  { href: "/console/new", external: false },
  { href: "/console/scopes", external: false },
  {
    href: "http://localhost:4400/oidc/.well-known/openid-configuration",
    external: true,
  },
];

const en = {
  eyebrow: "Developer docs",
  title: "Get started with Persona",
  tagline:
    "Let people bring the details they already keep in Persona to your app, and receive only the fields they approve — with the right value for the context you asked in.",
  openConsole: "Open console",
  onThisPage: "On this page",

  intro: {
    nav: "What is Persona",
    heading: "What is Persona",
    body: [
      "A person stores their details in Persona once: names, contact details, an identity document, a few health basics. Your app connects over OAuth 2.0 and OpenID Connect and receives only the fields that person approved — never the rest of the vault.",
      "There are no forms to design and no data to hold. You ask for a set of scopes, the person approves what they are comfortable with, and you read the result from one endpoint whenever you need it.",
    ],
    variant:
      "The headline behaviour: your app declares a purpose, and Persona suggests the name that fits it — the legal name to a clinic, the public one to a forum, the preferred one to a shop. The person can override the suggestion, and withdraw it later.",
  },

  flow: {
    nav: "How the flow works",
    heading: "How the flow works",
    lead: "A standard OpenID Connect authorization-code flow with PKCE. Persona owns the consent screen; every other step is your code.",
    steps: [
      {
        title: "Authorize",
        body: "Your app sends the browser to Persona with your client ID and the scopes you want.",
      },
      {
        title: "Consent",
        body: "The person signs in to Persona and chooses what to share. This screen is Persona's, not yours.",
      },
      {
        title: "Callback",
        body: "Persona sends the browser back to your redirect URI with a one-time code.",
      },
      {
        title: "Token",
        body: "Your server exchanges the code for an access token, over a back channel with your secret.",
      },
      {
        title: "Userinfo",
        body: "Your server calls one endpoint with the token and reads the approved fields.",
      },
    ],
  },

  register: {
    nav: "1. Register your app",
    heading: "Register your app",
    body: [
      "Open the developer console and register an app. You choose a purpose (which decides the suggested name variant), the scopes it may ask for, and up to five redirect URIs. Persona hands you a client ID and a client secret.",
      "The secret is shown once, at creation. Store it somewhere safe on your server; if you lose it, rotate for a new one. Then drop the values into your environment.",
    ],
    envLabel: ".env",
    envNote:
      "The two URLs are identical on a single machine. Under Docker the browser and your server reach Persona on different hostnames, so they differ.",
  },

  authorize: {
    nav: "2. Redirect to Persona",
    heading: "Redirect to Persona",
    body: [
      "Build the authorization URL and send the browser to it. Generate a random state and a PKCE verifier, keep both in short-lived httpOnly cookies for the callback, and send the SHA-256 challenge — never the verifier — in the URL.",
    ],
    label: "GET /connect",
    note: "Build the query with URLSearchParams so the scope's spaces and every value are encoded correctly.",
  },

  callback: {
    nav: "3. Handle the callback",
    heading: "Handle the callback",
    body: [
      "Persona returns the person to your redirect URI with a code. Check the state matches the one you stored — a constant-time compare is the whole CSRF defence — then exchange the code for a token from your server. The secret goes in an HTTP Basic header; it never touches the browser.",
    ],
    label: "GET /callback",
    note: "Authentication is client_secret_basic: the client ID and secret, base64-encoded, in the Authorization header. Send the PKCE verifier as code_verifier.",
  },

  userinfo: {
    nav: "4. Read the claims",
    heading: "Read the claims",
    body: [
      "With the access token, call the userinfo endpoint. It returns only the scopes that person approved — a declined field is simply absent, so read defensively. Read the claims from here, not from the ID token; the demos don't even keep the ID token.",
      "One claim is always there: sub, the person's Persona id. It is the only value stable enough to key your own records on — a name or an email can be edited, or withdrawn, without your app ever hearing about it.",
    ],
    label: "GET /oidc/me",
    note: "This call is what Persona records in the person's audit log, so make it when you need the data, not once and cached forever.",
  },

  react: {
    nav: "Connect button (React)",
    heading: "A connect button in React",
    body: [
      "There is nothing Persona-specific in the front end. The button is a link to your own /connect route, and the profile is whatever your server read from userinfo. The only rule that matters on the client: a field the person declined won't be there.",
    ],
    label: "Connect.jsx",
    note: "Every value is optional. Show a graceful fallback for anything the person chose not to share.",
  },

  scopes: {
    nav: "Scopes & purposes",
    heading: "Scopes & purposes",
    body: [
      "You ask for scopes; the person approves them. Mark a scope required, in the console, only if your app genuinely cannot work without it: a required scope cannot be declined, and someone with no value for it in their vault cannot connect at all.",
      "You ask for a name, not a version of it. Persona resolves the version from the purpose your app declared, and the person can pick another on the consent screen.",
    ],
    dataScopesHeading: "The data scopes",
    dataScopesNote: "Plus openid, which is always present.",
    purposesHeading: "Purpose to suggested name",
    catalogue: "See the full scope catalogue",
    variants: {
      legal: "Legal",
      professional: "Professional",
      public: "Public",
      preferred: "Preferred",
    } as Record<string, string>,
  },

  gotchas: {
    nav: "Gotchas",
    heading: "Things that trip people up",
    items: [
      {
        title: "Redirect URIs match exactly",
        body: "The redirect_uri you send must be one you registered, character for character. There is no wildcard matching, and a URL fragment is rejected outright.",
      },
      {
        title: "Ask only for scopes you registered",
        body: "An authorization naming a scope outside your app's list is rejected with invalid_scope, before the person sees anything. Add the scope in the console first.",
      },
      {
        title: "Narrowing scopes revokes every consent",
        body: "Removing a scope from an app drops every standing consent for it and kills the tokens behind them. Everyone who had connected is asked again on their next visit.",
      },
      {
        title: "An hour, and no refresh token",
        body: "Access tokens expire after an hour, and Persona issues no refresh token. When userinfo answers 401, send the person through your /connect route again.",
      },
      {
        title: "Paused or deleted apps stop working",
        body: "If you pause or delete an app in the console, new authorizations are rejected with invalid_client and existing tokens stop working — immediately, for everyone.",
      },
      {
        title: "Logout is yours to do",
        body: "Signing out means clearing your own session cookie. Persona's end_session_endpoint ends the person's own Persona session, not your access to their data — they withdraw that themselves in their Persona connections.",
      },
    ],
  },

  next: {
    nav: "Next steps",
    heading: "Next steps",
    items: [
      {
        label: "Register an app",
        note: "Get a client ID and secret in the console.",
      },
      {
        label: "Scope catalogue",
        note: "Every field, what it returns, and an example.",
      },
      {
        label: "Discovery document",
        note: "The OpenID configuration, with every endpoint.",
      },
    ],
  },
};

export type DocsContent = typeof en;

const es: DocsContent = {
  eyebrow: "Documentación para desarrolladores",
  title: "Empieza con Persona",
  tagline:
    "Deja que las personas traigan a tu app los datos que ya guardan en Persona y recibe solo los campos que aprueben, con el valor adecuado para el contexto en el que preguntaste.",
  openConsole: "Abrir consola",
  onThisPage: "En esta página",

  intro: {
    nav: "Qué es Persona",
    heading: "Qué es Persona",
    body: [
      "Una persona guarda sus datos en Persona una sola vez: nombres, datos de contacto, un documento de identidad, algunos datos básicos de salud. Tu app se conecta con OAuth 2.0 y OpenID Connect y recibe solo los campos que esa persona aprobó — nunca el resto de la bóveda.",
      "No hay formularios que diseñar ni datos que guardar. Pides un conjunto de permisos, la persona aprueba lo que le parece bien, y lees el resultado desde un único endpoint cuando lo necesites.",
    ],
    variant:
      "El comportamiento clave: tu app declara un propósito y Persona sugiere el nombre que encaja — el nombre legal a una clínica, el público a un foro, el preferido a una tienda. La persona puede cambiar la sugerencia y retirarla después.",
  },

  flow: {
    nav: "Cómo funciona el flujo",
    heading: "Cómo funciona el flujo",
    lead: "Un flujo estándar de OpenID Connect con código de autorización y PKCE. La pantalla de consentimiento es de Persona; todos los demás pasos son tu código.",
    steps: [
      {
        title: "Autorizar",
        body: "Tu app envía el navegador a Persona con tu client ID y los permisos que quieres.",
      },
      {
        title: "Consentir",
        body: "La persona inicia sesión en Persona y elige qué compartir. Esta pantalla es de Persona, no tuya.",
      },
      {
        title: "Callback",
        body: "Persona devuelve el navegador a tu redirect URI con un código de un solo uso.",
      },
      {
        title: "Token",
        body: "Tu servidor cambia el código por un token de acceso, por un canal trasero con tu secreto.",
      },
      {
        title: "Userinfo",
        body: "Tu servidor llama a un endpoint con el token y lee los campos aprobados.",
      },
    ],
  },

  register: {
    nav: "1. Registra tu app",
    heading: "Registra tu app",
    body: [
      "Abre la consola de desarrollador y registra una app. Eliges un propósito (que decide la variante de nombre sugerida), los permisos que puede pedir y hasta cinco redirect URIs. Persona te entrega un client ID y un client secret.",
      "El secreto se muestra una sola vez, al crearla. Guárdalo en un lugar seguro de tu servidor; si lo pierdes, rótalo por uno nuevo. Luego coloca los valores en tu entorno.",
    ],
    envLabel: ".env",
    envNote:
      "Las dos URLs son idénticas en una sola máquina. Con Docker el navegador y tu servidor llegan a Persona por hostnames distintos, así que difieren.",
  },

  authorize: {
    nav: "2. Redirige a Persona",
    heading: "Redirige a Persona",
    body: [
      "Construye la URL de autorización y envía el navegador allí. Genera un state aleatorio y un verifier PKCE, guarda ambos en cookies httpOnly de corta vida para el callback, y envía el desafío SHA-256 — nunca el verifier — en la URL.",
    ],
    label: "GET /connect",
    note: "Construye la query con URLSearchParams para que los espacios del scope y cada valor queden bien codificados.",
  },

  callback: {
    nav: "3. Atiende el callback",
    heading: "Atiende el callback",
    body: [
      "Persona devuelve a la persona a tu redirect URI con un código. Comprueba que el state coincide con el que guardaste — una comparación de tiempo constante es toda la defensa contra CSRF — y luego cambia el código por un token desde tu servidor. El secreto va en una cabecera HTTP Basic; nunca toca el navegador.",
    ],
    label: "GET /callback",
    note: "La autenticación es client_secret_basic: el client ID y el secreto, en base64, en la cabecera Authorization. Envía el verifier PKCE como code_verifier.",
  },

  userinfo: {
    nav: "4. Lee los datos",
    heading: "Lee los datos",
    body: [
      "Con el token de acceso, llama al endpoint userinfo. Devuelve solo los permisos que esa persona aprobó — un campo rechazado simplemente no está, así que léelo con cuidado. Lee los datos desde aquí, no del ID token; las demos ni siquiera guardan el ID token.",
      "Un dato siempre viene: sub, el identificador de la persona en Persona. Es el único valor lo bastante estable para guardar en tus registros — un nombre o un correo se pueden editar, o retirar, sin que tu app se entere.",
    ],
    label: "GET /oidc/me",
    note: "Esta llamada es lo que Persona registra en el historial de la persona, así que hazla cuando necesites los datos, no una vez y en caché para siempre.",
  },

  react: {
    nav: "Botón de conexión (React)",
    heading: "Un botón de conexión en React",
    body: [
      "No hay nada específico de Persona en el front end. El botón es un enlace a tu propia ruta /connect, y el perfil es lo que tu servidor leyó de userinfo. La única regla que importa en el cliente: un campo que la persona rechazó no estará.",
    ],
    label: "Connect.jsx",
    note: "Todo valor es opcional. Muestra una alternativa amable para lo que la persona decidió no compartir.",
  },

  scopes: {
    nav: "Permisos y propósitos",
    heading: "Permisos y propósitos",
    body: [
      "Tú pides permisos; la persona los aprueba. Marca un permiso como obligatorio, en la consola, solo si tu app de verdad no funciona sin él: un permiso obligatorio no se puede rechazar, y quien no tenga ese dato en su bóveda no podrá conectarse.",
      "Pides un nombre, no una versión de él. Persona resuelve la versión a partir del propósito que declaró tu app, y la persona puede elegir otra en la pantalla de consentimiento.",
    ],
    dataScopesHeading: "Los permisos de datos",
    dataScopesNote: "Más openid, que siempre está presente.",
    purposesHeading: "Propósito y nombre sugerido",
    catalogue: "Ver el catálogo completo de permisos",
    variants: {
      legal: "Legal",
      professional: "Profesional",
      public: "Público",
      preferred: "Preferido",
    } as Record<string, string>,
  },

  gotchas: {
    nav: "Trampas comunes",
    heading: "Cosas que suelen confundir",
    items: [
      {
        title: "Los redirect URIs coinciden exactos",
        body: "El redirect_uri que envías debe ser uno que registraste, carácter por carácter. No hay comodines, y un fragmento en la URL se rechaza de plano.",
      },
      {
        title: "Pide solo permisos registrados",
        body: "Una autorización que nombra un permiso fuera de la lista de tu app se rechaza con invalid_scope, antes de que la persona vea nada. Añade el permiso en la consola primero.",
      },
      {
        title: "Recortar permisos revoca todo",
        body: "Quitar un permiso de una app elimina todos los consentimientos vigentes y anula los tokens detrás de ellos. Todos los que se habían conectado vuelven a decidir en su próxima visita.",
      },
      {
        title: "Una hora, y sin refresh token",
        body: "Los tokens de acceso caducan en una hora y Persona no emite refresh token. Cuando userinfo responda 401, manda a la persona otra vez por tu ruta /connect.",
      },
      {
        title: "Apps pausadas o borradas dejan de servir",
        body: "Si pausas o borras una app en la consola, las nuevas autorizaciones se rechazan con invalid_client y los tokens existentes dejan de funcionar — al instante, para todos.",
      },
      {
        title: "El cierre de sesión es cosa tuya",
        body: "Cerrar sesión es borrar tu propia cookie de sesión. El end_session_endpoint de Persona cierra la sesión que la persona tiene en Persona, no tu acceso a sus datos — eso lo retira ella misma en sus conexiones de Persona.",
      },
    ],
  },

  next: {
    nav: "Siguientes pasos",
    heading: "Siguientes pasos",
    items: [
      {
        label: "Registrar una app",
        note: "Consigue un client ID y un secreto en la consola.",
      },
      {
        label: "Catálogo de permisos",
        note: "Cada campo, qué devuelve y un ejemplo.",
      },
      {
        label: "Documento de descubrimiento",
        note: "La configuración OpenID, con todos los endpoints.",
      },
    ],
  },
};

export function getDocsContent(locale?: string): DocsContent {
  return locale === "es" ? es : en;
}

export type { Locale };
