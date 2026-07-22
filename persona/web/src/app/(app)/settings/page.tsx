import { t } from "@/lib/strings";

export default function SettingsPage() {
  return (
    <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{t.settings.title}</h1>
  );
}
