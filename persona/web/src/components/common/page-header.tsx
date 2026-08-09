// The mobile shell header already shows the page name, so the heading only
// appears from `lg` up. The lead paragraph shows at every width.
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <>
      <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{title}</h1>
      {lead ? <p className="mt-1 text-sm text-muted-foreground">{lead}</p> : null}
    </>
  );
}
