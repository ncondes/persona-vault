"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { useStrings } from "@/lib/locale";

export default function ContextsPage() {
  const t = useStrings();
  return (
    <div className="max-w-2xl">
      <PageHeader title={t.contexts.title} lead={t.contexts.lead} />
      <div className="mt-6 flex flex-col gap-3">
        {t.contexts.cards.map((card) => (
          <Card key={card.title}>
            <CardContent>
              <div className="flex items-center gap-2.5">
                <span className="bg-brand size-2 rounded-full" />
                <h2 className="font-semibold">{card.title}</h2>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
