import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook. Aborts in flight requests on unmount and on
 * dependency change, so a fast navigation can never write a stale response
 * into a component that has moved on.
 */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: immediate,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (signal) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current(signal);
      if (signal?.aborted) return undefined;
      setState({ data, error: null, loading: false });
      return data;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) return undefined;
      setState({ data: null, error: err, loading: false });
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run(), [run]);

  return { ...state, refresh, setData: (data) => setState((s) => ({ ...s, data })) };
}

export default useAsync;
