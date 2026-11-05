'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { markClientChangesRead } from './actions';

export function useClientChangeVisit(listId, clientChanges) {
  const [opening] = useState(() => ({
    revision: clientChanges?.observedRevision ?? 0,
    changesByProduct: new Map((clientChanges?.products ?? []).map((change) => [change.productId, change])),
  }));
  const hasChanges = opening.changesByProduct.size > 0;
  const [readStatus, setReadStatus] = useState(hasChanges ? 'pending' : 'success');
  const mounted = useRef(false);
  const started = useRef(false);
  const inFlight = useRef(false);

  const retry = useCallback(async () => {
    if (!hasChanges || inFlight.current) return;
    inFlight.current = true;
    setReadStatus('pending');
    try {
      const result = await markClientChangesRead(listId, opening.revision);
      if (mounted.current) setReadStatus(result.ok ? 'success' : 'error');
    } catch (error) {
      unstable_rethrow(error);
      if (mounted.current) setReadStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [listId, opening, hasChanges]);

  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      void retry();
    }
    return () => { mounted.current = false; };
  }, [retry]);

  return { changesByProduct: opening.changesByProduct, readStatus, retry };
}
