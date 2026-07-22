interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, body, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center">
      {icon ? <div className="mb-4">{icon}</div> : null}
      <p className="font-medium text-zinc-700">{title}</p>
      {body ? <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
