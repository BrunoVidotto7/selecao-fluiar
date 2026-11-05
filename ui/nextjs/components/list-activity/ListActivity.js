'use client';
import { useEffect, useRef } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { recordAdminListActivity, recordClientListActivity } from './actions';

export default function ListActivity({ listId, client = false }) {
  const recorded = useRef(null);
  useEffect(() => {
    const key = `${client}:${listId}`;
    if (recorded.current === key) return;
    recorded.current = key;
    const record = client ? recordClientListActivity : recordAdminListActivity;
    record(listId).catch((error) => { unstable_rethrow(error); });
  }, [listId, client]);
  return null;
}
