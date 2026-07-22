"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal data loader: fetch on mount, expose reload for after mutations.
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return loader().then(setData, setError).finally(() => setLoading(false));
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
