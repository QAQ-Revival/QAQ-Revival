import React from "react";

// Keep one read in flight and one follow-up for changes received during that
// read. A burst of import notifications must not queue hundreds of disk scans.
export function useCoalescedRefresh(read) {
  const readRef = React.useRef(read);
  readRef.current = read;
  const running = React.useRef(null);
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      running.current = null;
    };
  }, []);
  return React.useCallback((options = {}) => {
    if (!live.current) return Promise.resolve(false);
    if (running.current) {
      const previous = running.current.next;
      running.current.next = {
        ...previous,
        ...options,
        force: !!(previous?.force || options.force),
        syncCharacterCache: !!(previous?.syncCharacterCache || options.syncCharacterCache),
      };
      return running.current.promise;
    }
    const job = { next: options, promise: null };
    running.current = job;
    const isCurrent = () => live.current && running.current === job;
    job.promise = (async () => {
      let result;
      while (job.next && isCurrent()) {
        const next = job.next;
        job.next = null;
        result = await readRef.current(next, isCurrent);
      }
      return result;
    })().finally(() => {
      if (running.current === job) running.current = null;
    });
    return job.promise;
  }, []);
}
