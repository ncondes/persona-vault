import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/strings";

export default function ContextsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{t.contexts.title}</h1>
      <p className="mt-1 text-muted-foreground">{t.contexts.lead}</p>
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
