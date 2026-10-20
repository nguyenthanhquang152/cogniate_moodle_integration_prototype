import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";

export function useApi<T>(path: string, pollMs?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const answer = await api<T>(path, { signal: controller.signal });
        if (active) {
          setData(answer);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(reason);
      } finally {
        if (active) {
          setLoading(false);
          if (pollMs)
            timer = setTimeout(() => {
              void load();
            }, pollMs);
        }
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, pollMs, revision]);
  return { data, setData, error, loading, reload };
}

/** Ignore a completed write when its form has already left the screen. */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}
