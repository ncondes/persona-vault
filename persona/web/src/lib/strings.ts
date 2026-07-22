// Every user-facing string lives here, per locale. `en` defines the shape;
// `es` must match it.

export type Locale = "en" | "es";

const en = {
  appName: "Persona",
  tagline: "Your data, shared on your terms",

  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    add: "Add",
    edit: "Edit",
    skip: "Add later",
    continue: "Continue",
    back: "Back",
    makeDefault: "Make default",
    defaultBadge: "Default",
    requiredBadge: "Required",
    sensitiveBadge: "Sensitive",
    optionalBadge: "Optional",
    loading: "Loading…",
    somethingWrong: "Something went wrong. Please try again.",
  },

  nav: {
    vault: "My data",
    connections: "Connections",
    settings: "Settings",
    contexts: "Contexts",
    logout: "Log out",
  },

  auth: {
    signIn: "Sign in",
    signInLead: "Sign in to choose what you share.",
    signUp: "Create account",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    password: "Password",
    noAccount: "New here? Create your Persona",
    haveAccount: "Already have an account? Sign in",
    errors: {
      EMAIL_TAKEN: "An account with that email already exists.",
      INVALID_CREDENTIALS: "Invalid email or password.",
    } as Record<string, string>,
  },

  landing: {
    title: "Your data lives here",
    body: "You decide what to share and with whom. Persona fills forms for you without handing everything over.",
    points: ["Save your data once", "Share it with one tap", "Never passwords or cards"],
    cta: "Get started",
    signIn: "Sign in",
  },

  onboarding: {
    welcomeNote: "Takes less than 2 minutes",
    essentials: {
      title: "The essentials",
      lead: "Let's start with the basics.",
      emailHint: "We'll use it to identify you. We never share it without your permission.",
    },
    contact: {
      title: "Contact",
      lead: "Your vault grows as you use it. You can skip this and add it later.",
    },
    document: {
      title: "Document",
      lead: "Almost every formal process asks for it. Type it once.",
      hint: "Persona doesn't store photos of your document, only the number you type.",
    },
    health: {
      title: "Health",
      lead: "Useful for appointments and emergencies. Only ever shared with your permission.",
    },
    success: {
      title: (name: string) => `All set, ${name}`,
      body: "Your vault is ready. Add more data whenever you want, or when an app asks for it.",
      itemsSaved: (n: number) => `${n} item${n === 1 ? "" : "s"} saved`,
      cta: "Go to my data",
    },
  },

  vault: {
    title: "My data",
    sections: {
      identity: "Identity",
      document: "Document",
      contact: "Contact",
      location: "Location",
      health: "Health",
    } as Record<string, string>,
    kinds: {
      name: "Name",
      username: "Username",
      avatar: "Avatar",
      birth_date: "Date of birth",
      document: "Document",
      email: "Email",
      phone: "Phone",
      address: "Address",
      blood_type: "Blood type",
      eps: "Health insurer (EPS)",
      allergy: "Allergies",
    } as Record<string, string>,
    nameContexts: {
      legal: "Legal",
      preferred: "Preferred",
      professional: "Professional",
      public: "Public",
    } as Record<string, string>,
    documentFields: { type: "Type", number: "Number", issueDate: "Issued", issuePlace: "Place" },
    phoneFields: { countryCode: "Prefix", number: "Number" },
    addressFields: {
      street: "Street",
      details: "Details (apt, unit…)",
      city: "City",
      region: "Region / department",
      postalCode: "Postal code",
      country: "Country",
    },
    nameContextLabel: "Context",
    label: "Label",
    labelHint: "e.g. Personal, Work",
    addValue: (kind: string) => `Add ${kind.toLowerCase()}`,
    emptyGroup: (kind: string) => `No ${kind.toLowerCase()} added yet`,
    usedIn: "used in:",
    deleteConfirm: "Delete this value? Apps it was shared with will stop receiving it.",
    errors: {
      SINGLE_VALUE_KIND: "Only one value is allowed here — edit the existing one.",
    } as Record<string, string>,
  },

  contexts: {
    title: "Contexts",
    lead: "What each data group is for.",
    cards: [
      {
        title: "Government & formal",
        body: "Document, full legal name, date of birth. Banks, insurers, registries, contracts.",
      },
      {
        title: "Health",
        body: "Document, health insurer, blood type and allergies. Appointments and emergencies.",
      },
      {
        title: "Shopping & delivery",
        body: "Name, phone, email, shipping address. E-commerce and deliveries.",
      },
      {
        title: "Basic identity",
        body: "Username, email, name. Apps, communities and quick sign-ups.",
      },
    ],
  },

  scopes: {
    name: "Full name",
    given_name: "First name",
    family_name: "Last name",
    username: "Username",
    email: "Email",
    phone: "Phone",
    address: "Address",
    birth_date: "Date of birth",
    document: "Document",
    blood_type: "Blood type",
    eps: "Health insurer (EPS)",
    allergies: "Allergies",
  } as Record<string, string>,

  catalog: {
    documentTypes: {
      CC: "National ID (CC)",
      TI: "Identity card (TI)",
      CE: "Foreigner ID (CE)",
      PASSPORT: "Passport",
      PEP_PPT: "Temporary permit (PEP/PPT)",
    } as Record<string, string>,
    bloodTypes: {
      A_POS: "A+",
      A_NEG: "A−",
      B_POS: "B+",
      B_NEG: "B−",
      AB_POS: "AB+",
      AB_NEG: "AB−",
      O_POS: "O+",
      O_NEG: "O−",
    } as Record<string, string>,
    epsProviders: {
      SURA: "EPS Sura",
      SANITAS: "Sanitas",
      NUEVA_EPS: "Nueva EPS",
      SALUD_TOTAL: "Salud Total",
      COMPENSAR: "Compensar",
      FAMISANAR: "Famisanar",
      COOSALUD: "Coosalud",
      MUTUAL_SER: "Mutual Ser",
    } as Record<string, string>,
  },

  consent: {
    wantsAccess: "wants to access",
    itemCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    verified: "Verified identity · only what you enable",
    sensitiveDivider: "Sensitive data",
    missingBadge: "Missing from your vault",
    addAndSave: "Add and save to my vault",
    missingNote: "We'll keep it for next time. It's only shared if you approve it here.",
    trivialNote: "Nothing sensitive. This is one click.",
    optionalMissing: "Not in your vault — it won't be shared.",
    confirmTitle: "Share sensitive data?",
    confirmBody: (n: number) =>
      `${n} sensitive item${n === 1 ? "" : "s"} will be shared. You can switch them off before approving.`,
    approve: "Share this data",
    approveMissing: "Complete the missing data to continue",
    dontShare: "Don't share",
    footerNote: "Persona doesn't keep what you don't enable",
    expiredTitle: "Request expired",
    expiredBody: "This request has expired or was already completed. Start again from the app you were using.",
  },

  connections: {
    title: "Connections",
    lead: "What you've shared. You can revoke it any time.",
    itemCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    sharedData: "Shared data",
    revoke: "Revoke access",
    revokeConfirm: (name: string) =>
      `Revoke ${name}'s access? It will stop receiving your data immediately.`,
    empty: "You're not sharing with anyone yet",
    emptyBody: 'When you use "Sign in with Persona" in an app, you\'ll see here what you shared and can revoke it.',
  },

  settings: {
    title: "Settings",
    privacy: "Privacy",
    confirmSensitive: "Confirm sensitive data",
    notifyAccess: "Notify me of each access",
    downloadData: "Download my data",
    dangerZone: "Danger zone",
    logout: "Log out",
    deleteAccount: "Delete account and vault",
    deleteWarning: "This can't be undone",
    deleteConfirm:
      "Delete your account and everything in your vault? Connected apps lose access immediately. This can't be undone.",
  },
};

export type Strings = typeof en;

const es: Strings = {
  appName: "Persona",
  tagline: "Tus datos, compartidos en tus términos",

  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    add: "Añadir",
    edit: "Editar",
    skip: "Añadir luego",
    continue: "Continuar",
    back: "Atrás",
    makeDefault: "Marcar predeterminado",
    defaultBadge: "Predeterminado",
    requiredBadge: "Requerido",
    sensitiveBadge: "Sensible",
    optionalBadge: "Opcional",
    loading: "Cargando…",
    somethingWrong: "Algo salió mal. Inténtalo de nuevo.",
  },

  nav: {
    vault: "Mis datos",
    connections: "Conexiones",
    settings: "Ajustes",
    contexts: "Contextos",
    logout: "Cerrar sesión",
  },

  auth: {
    signIn: "Iniciar sesión",
    signInLead: "Inicia sesión para elegir qué compartes.",
    signUp: "Crear cuenta",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo electrónico",
    password: "Contraseña",
    noAccount: "¿Nuevo aquí? Crea tu Persona",
    haveAccount: "¿Ya tienes cuenta? Inicia sesión",
    errors: {
      EMAIL_TAKEN: "Ya existe una cuenta con ese correo.",
      INVALID_CREDENTIALS: "Correo o contraseña inválidos.",
    },
  },

  landing: {
    title: "Tus datos viven aquí",
    body: "Tú decides qué compartir y con quién. Persona rellena formularios por ti, sin entregar todo.",
    points: ["Guarda tus datos una sola vez", "Compártelos con un toque", "Nunca contraseñas ni tarjetas"],
    cta: "Empezar",
    signIn: "Iniciar sesión",
  },

  onboarding: {
    welcomeNote: "Toma menos de 2 minutos",
    essentials: {
      title: "Lo esencial",
      lead: "Empecemos con lo básico.",
      emailHint: "Lo usaremos para identificarte. Nunca lo compartimos sin tu permiso.",
    },
    contact: {
      title: "Contacto",
      lead: "Tu vault crece con el uso. Puedes saltarte esto y añadirlo luego.",
    },
    document: {
      title: "Documento",
      lead: "Lo piden casi todos los trámites. Lo escribes una vez.",
      hint: "Persona no guarda fotos del documento, solo el número que escribes.",
    },
    health: {
      title: "Salud",
      lead: "Útil para citas y urgencias. Solo se comparte con tu permiso.",
    },
    success: {
      title: (name: string) => `Listo, ${name}`,
      body: "Tu vault está creado. Añade más datos cuando quieras, o cuando una app los pida.",
      itemsSaved: (n: number) => `${n} dato${n === 1 ? "" : "s"} guardado${n === 1 ? "" : "s"}`,
      cta: "Ir a mis datos",
    },
  },

  vault: {
    title: "Mis datos",
    sections: {
      identity: "Identidad",
      document: "Documento",
      contact: "Contacto",
      location: "Ubicación",
      health: "Salud",
    },
    kinds: {
      name: "Nombre",
      username: "Nombre de usuario",
      avatar: "Avatar",
      birth_date: "Fecha de nacimiento",
      document: "Documento",
      email: "Correo",
      phone: "Teléfono",
      address: "Dirección",
      blood_type: "Grupo sanguíneo",
      eps: "EPS",
      allergy: "Alergias",
    },
    nameContexts: {
      legal: "Legal",
      preferred: "Preferido",
      professional: "Profesional",
      public: "Público",
    },
    documentFields: { type: "Tipo", number: "Número", issueDate: "Expedición", issuePlace: "Lugar" },
    phoneFields: { countryCode: "Prefijo", number: "Número" },
    addressFields: {
      street: "Calle",
      details: "Detalles (apto, interior…)",
      city: "Ciudad",
      region: "Región / departamento",
      postalCode: "Código postal",
      country: "País",
    },
    nameContextLabel: "Contexto",
    label: "Etiqueta",
    labelHint: "p. ej. Personal, Trabajo",
    addValue: (kind: string) => `Añadir ${kind.toLowerCase()}`,
    emptyGroup: (kind: string) => `Aún no has añadido ${kind.toLowerCase()}`,
    usedIn: "se usa en:",
    deleteConfirm: "¿Eliminar este valor? Las apps con las que se compartió dejarán de recibirlo.",
    errors: {
      SINGLE_VALUE_KIND: "Solo se permite un valor aquí — edita el existente.",
    },
  },

  contexts: {
    title: "Contextos",
    lead: "Para qué sirve cada grupo de datos.",
    cards: [
      {
        title: "Trámites y gobierno",
        body: "Documento, nombre legal completo, fecha de nacimiento. Bancos, aseguradoras, registros, contratos.",
      },
      {
        title: "Salud",
        body: "Documento, EPS, grupo sanguíneo y alergias. Citas y urgencias.",
      },
      {
        title: "Compras y envíos",
        body: "Nombre, teléfono, correo, dirección de envío. E-commerce y domicilios.",
      },
      {
        title: "Identidad básica",
        body: "Nombre de usuario, correo, nombre. Apps, comunidades y registro exprés.",
      },
    ],
  },

  scopes: {
    name: "Nombre completo",
    given_name: "Nombre",
    family_name: "Apellido",
    username: "Nombre de usuario",
    email: "Correo",
    phone: "Teléfono",
    address: "Dirección",
    birth_date: "Fecha de nacimiento",
    document: "Documento",
    blood_type: "Grupo sanguíneo",
    eps: "EPS",
    allergies: "Alergias",
  },

  catalog: {
    documentTypes: {
      CC: "Cédula de ciudadanía (CC)",
      TI: "Tarjeta de identidad (TI)",
      CE: "Cédula de extranjería (CE)",
      PASSPORT: "Pasaporte",
      PEP_PPT: "Permiso temporal (PEP/PPT)",
    },
    bloodTypes: {
      A_POS: "A+",
      A_NEG: "A−",
      B_POS: "B+",
      B_NEG: "B−",
      AB_POS: "AB+",
      AB_NEG: "AB−",
      O_POS: "O+",
      O_NEG: "O−",
    },
    epsProviders: {
      SURA: "EPS Sura",
      SANITAS: "Sanitas",
      NUEVA_EPS: "Nueva EPS",
      SALUD_TOTAL: "Salud Total",
      COMPENSAR: "Compensar",
      FAMISANAR: "Famisanar",
      COOSALUD: "Coosalud",
      MUTUAL_SER: "Mutual Ser",
    },
  },

  consent: {
    wantsAccess: "quiere acceder a",
    itemCount: (n: number) => `${n} dato${n === 1 ? "" : "s"}`,
    verified: "Identidad verificada · solo lo que actives",
    sensitiveDivider: "Datos sensibles",
    missingBadge: "Falta en tu vault",
    addAndSave: "Añadir y guardar en mi vault",
    missingNote: "La guardamos para la próxima vez. Solo se comparte si lo apruebas aquí.",
    trivialNote: "Nada sensible. Esto es de un clic.",
    optionalMissing: "No está en tu vault — no se compartirá.",
    confirmTitle: "¿Compartir datos sensibles?",
    confirmBody: (n: number) =>
      n === 1
        ? "Se compartirá 1 dato sensible. Puedes desactivarlo antes de aprobar."
        : `Se compartirán ${n} datos sensibles. Puedes desactivarlos antes de aprobar.`,
    approve: "Compartir estos datos",
    approveMissing: "Completa los datos faltantes para continuar",
    dontShare: "No compartir",
    footerNote: "Persona no guarda lo que no actives",
    expiredTitle: "Solicitud expirada",
    expiredBody: "Esta solicitud expiró o ya se completó. Empieza de nuevo desde la app que estabas usando.",
  },

  connections: {
    title: "Conexiones",
    lead: "Lo que compartiste. Puedes revocarlo cuando quieras.",
    itemCount: (n: number) => `${n} dato${n === 1 ? "" : "s"}`,
    sharedData: "Datos compartidos",
    revoke: "Revocar acceso",
    revokeConfirm: (name: string) =>
      `¿Revocar el acceso de ${name}? Dejará de recibir tus datos de inmediato.`,
    empty: "Aún no compartes con nadie",
    emptyBody: 'Cuando uses "Ingresar con Persona" en una app, verás aquí qué compartiste y podrás revocarlo.',
  },

  settings: {
    title: "Ajustes",
    privacy: "Privacidad",
    confirmSensitive: "Confirmar datos sensibles",
    notifyAccess: "Avisarme de cada acceso",
    downloadData: "Descargar mis datos",
    dangerZone: "Zona de riesgo",
    logout: "Cerrar sesión",
    deleteAccount: "Eliminar cuenta y vault",
    deleteWarning: "No se puede deshacer",
    deleteConfirm:
      "¿Eliminar tu cuenta y todo tu vault? Las apps conectadas pierden acceso de inmediato. No se puede deshacer.",
  },
};

const STRINGS: Record<Locale, Strings> = { en, es };

export function getStrings(locale?: string): Strings {
  return STRINGS[locale === "es" ? "es" : "en"];
}
