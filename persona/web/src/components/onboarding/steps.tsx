"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ApiError, createItem, register } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { flagOf } from "@/lib/sections";
import type { Strings } from "@/lib/strings";
import type { Catalog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { StepShell } from "./step-shell";

interface StepProps {
  total: number;
  done: number;
  onDone: (itemsAdded: number) => void;
  onBack?: () => void;
}

function errorText(t: Strings, err: unknown): string {
  if (err instanceof ApiError) {
    return t.auth.errors[err.code] ?? Object.values(err.fields ?? {})[0] ?? err.message;
  }
  return t.common.somethingWrong;
}

export function EssentialsStep({
  total,
  done,
  onDone,
  onName,
}: StepProps & { onName: (fullName: string) => void }) {
  const t = useStrings();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(firstName, lastName, email, password);
      onName(`${firstName} ${lastName}`.trim());
      onDone(2); // the vault starts with name + email
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  };

  return (
    <StepShell
      total={total}
      done={done}
      title={t.onboarding.essentials.title}
      lead={t.onboarding.essentials.lead}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.auth.firstName} htmlFor="firstName">
          <Input id="firstName" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label={t.auth.lastName} htmlFor="lastName">
          <Input id="lastName" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      <Field label={t.auth.email} htmlFor="email" hint={t.onboarding.essentials.emailHint}>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <Input
          id="password"
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
    </StepShell>
  );
}

export function ContactStep({
  total,
  done,
  onDone,
  onBack,
  catalog,
}: StepProps & { catalog: Catalog | null }) {
  const t = useStrings();
  const [dial, setDial] = useState("+57");
  const [number, setNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("CO");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let added = 0;
      if (number.trim()) {
        await createItem({
          kind: "phone",
          detail: { countryCode: dial, number: number.trim() },
        });
        added += 1;
      }
      if (street.trim() || city.trim()) {
        await createItem({
          kind: "address",
          detail: { street: street.trim(), city: city.trim(), country },
        });
        added += 1;
      }
      onDone(added);
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  };

  return (
    <StepShell
      total={total}
      done={done}
      title={t.onboarding.contact.title}
      lead={t.onboarding.contact.lead}
      optional
      onBack={onBack}
      onSkip={() => onDone(0)}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid grid-cols-[7.5rem_1fr] gap-3">
        <Field label={t.vault.phoneFields.countryCode} htmlFor="dial">
          <Select value={dial} onValueChange={setDial}>
            <SelectTrigger id="dial" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(catalog?.countries ?? []).map((c) => (
                <SelectItem key={c.code} value={c.dial}>
                  {flagOf(c.code)} {c.dial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.vault.kinds.phone} htmlFor="phone">
          <Input id="phone" type="tel" value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
      </div>
      <Field label={t.vault.addressFields.street} htmlFor="street">
        <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
      </Field>
      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <Field label={t.vault.addressFields.city} htmlFor="city">
          <Input id="city" required={street.trim().length > 0} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label={t.vault.addressFields.country} htmlFor="country">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="country" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(catalog?.countries ?? []).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {flagOf(c.code)} {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </StepShell>
  );
}

export function DocumentStep({
  total,
  done,
  onDone,
  onBack,
  catalog,
}: StepProps & { catalog: Catalog | null }) {
  const t = useStrings();
  const [type, setType] = useState("CC");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [issuePlace, setIssuePlace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim()) return onDone(0);
    setBusy(true);
    setError(null);
    try {
      await createItem({
        kind: "document",
        value: number.trim(),
        detail: { type, issueDate, issuePlace },
      });
      onDone(1);
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  };

  return (
    <StepShell
      total={total}
      done={done}
      title={t.onboarding.document.title}
      lead={t.onboarding.document.lead}
      optional
      onBack={onBack}
      onSkip={() => onDone(0)}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <Field label={t.vault.documentFields.type} htmlFor="docType">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="docType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(catalog?.documentTypes ?? []).map((code) => (
              <SelectItem key={code} value={code}>
                {t.catalog.documentTypes[code] ?? code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label={t.vault.documentFields.number}
        htmlFor="docNumber"
        hint={t.onboarding.document.hint}
      >
        <Input
          id="docNumber"
          className="font-mono"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </Field>
      {number.trim() ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.vault.documentFields.issueDate} htmlFor="issueDate">
            <Input
              id="issueDate"
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
          <Field label={t.vault.documentFields.issuePlace} htmlFor="issuePlace">
            <Input
              id="issuePlace"
              required
              value={issuePlace}
              onChange={(e) => setIssuePlace(e.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </StepShell>
  );
}

export function HealthStep({
  total,
  done,
  onDone,
  onBack,
  catalog,
}: StepProps & { catalog: Catalog | null }) {
  const t = useStrings();
  const [bloodType, setBloodType] = useState("");
  const [eps, setEps] = useState("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let added = 0;
      if (bloodType) {
        await createItem({ kind: "blood_type", value: bloodType });
        added += 1;
      }
      if (eps) {
        await createItem({ kind: "eps", value: eps });
        added += 1;
      }
      for (const allergy of allergies.split(",").map((a) => a.trim()).filter(Boolean)) {
        await createItem({ kind: "allergy", value: allergy });
        added += 1;
      }
      onDone(added);
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  };

  const codeSelect = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    codes: string[],
    labels: Record<string, string>,
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {labels[code] ?? code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <StepShell
      total={total}
      done={done}
      title={t.onboarding.health.title}
      lead={t.onboarding.health.lead}
      sensitive
      onBack={onBack}
      onSkip={() => onDone(0)}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.vault.kinds.blood_type} htmlFor="bloodType">
          {codeSelect("bloodType", bloodType, setBloodType, catalog?.bloodTypes ?? [], t.catalog.bloodTypes)}
        </Field>
        <Field label={t.vault.kinds.eps} htmlFor="eps">
          {codeSelect("eps", eps, setEps, catalog?.epsProviders ?? [], t.catalog.epsProviders)}
        </Field>
      </div>
      <Field label={t.vault.kinds.allergy} htmlFor="allergies" hint="Separate with commas">
        <Input id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
      </Field>
    </StepShell>
  );
}

export function SuccessStep({ fullName, itemsSaved }: { fullName: string; itemsSaved: number }) {
  const t = useStrings();
  const firstName = fullName.split(" ")[0] || fullName;
  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-zinc-200 bg-white p-7 py-12 text-center shadow-sm">
      <div className="bg-brand-tint flex size-[74px] items-center justify-center rounded-full">
        <div className="bg-brand flex size-12 items-center justify-center rounded-full text-white">
          <Check className="size-6" strokeWidth={3} />
        </div>
      </div>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight">
        {t.onboarding.success.title(firstName)}
      </h1>
      <p className="mt-2 max-w-xs text-[15px] text-muted-foreground">{t.onboarding.success.body}</p>
      <span className="mt-6 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">
        {t.onboarding.success.itemsSaved(itemsSaved)}
      </span>
      <Button size="xl" className="mt-8 w-full" onClick={() => window.location.assign("/vault")}>
        {t.onboarding.success.cta}
      </Button>
    </div>
  );
}
