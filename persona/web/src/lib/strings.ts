// Every user-facing string lives here so another locale can be added by
// swapping the exported object.

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
    fullName: "Full name",
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
      lead: "Let's start with the basics. Just three fields.",
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
    wantsAccess: (n: number) => `wants to access ${n} item${n === 1 ? "" : "s"}`,
    verified: "Verified identity · only what you enable",
    sensitiveDivider: "Sensitive data",
    missingBadge: "Missing from your vault",
    addAndSave: "Add and save to my vault",
    missingNote: "We'll keep it for next time. It's only shared if you approve it here.",
    trivialNote: "Nothing sensitive. This is one click.",
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
} as const;

export type Strings = typeof en;
export const t: Strings = en;
