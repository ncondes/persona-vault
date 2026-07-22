"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { getStrings, type Locale, type Strings } from "./strings";

interface LocaleValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Strings;
}

const LocaleContext = createContext<LocaleValue>({
  locale: "en",
  setLocale: () => {},
  t: getStrings("en"),
});

// The locale lives in a cookie so server components render the same language;
// switching also refreshes them.
export function LocaleProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `locale=${next};path=/;max-age=31536000;samesite=lax`;
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: getStrings(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext);
  return { locale, setLocale };
}

export function useStrings(): Strings {
  return useContext(LocaleContext).t;
}
