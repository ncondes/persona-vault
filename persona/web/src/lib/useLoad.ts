"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal data loader: fetch on mount, expose reload for after mutations.
// Reloads deliberately leave `loading` alone so a refetch after a mutation
// does not flash the spinner.
export function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return loader().then(setData, setError);
  }, [loader]);

  useEffect(() => {
    let active = true;
    loader()
      .then(
        (next) => {
          if (active) setData(next);
        },
        (err: Error) => {
          if (active) setError(err);
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loader]);

  return { data, loading, error, reload };
}
