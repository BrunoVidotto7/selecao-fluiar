'use client';
import { useState } from 'react';
import Button from '../ui/Button';
import { LIST_ROLE_LABELS } from '@/lib/list-roles';

function RoleSelect({ label, value, onChange }) {
  return (
    <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(LIST_ROLE_LABELS).map(([role, name]) => <option key={role} value={role}>{name}</option>)}
    </select>
  );
}

/** @param {{ clients: { id: string, name: string }[], principalId: string, value: { clientId: string, role: string }[], onChange: (value: { clientId: string, role: string }[]) => void, error?: string }} props */
export default function ListMembersField({ clients, principalId, value, onChange, error }) {
  const [clientId, setClientId] = useState('');
  const [role, setRole] = useState('READER');
  const nameOf = (id) => clients.find((c) => c.id === id)?.name ?? '';
  const available = clients.filter((c) => c.id !== principalId && !value.some((m) => m.clientId === c.id));

  const add = () => {
    if (!available.some((c) => c.id === clientId)) return;
    onChange([...value, { clientId, role }]);
    setClientId('');
    setRole('READER');
  };

  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={error ? 'members-err' : undefined}>
      <legend className="lbl" style={{ padding: 0 }}>Outros perfis com acesso</legend>
      {value.map((m) => (
        <div key={m.clientId} className="members-row">
          <span>{nameOf(m.clientId)}</span>
          <RoleSelect label={`Nível de acesso de ${nameOf(m.clientId)}`} value={m.role}
            onChange={(next) => onChange(value.map((x) => (x.clientId === m.clientId ? { ...x, role: next } : x)))} />
          <Button variant="text-danger" aria-label={`Remover ${nameOf(m.clientId)}`} onClick={() => onChange(value.filter((x) => x.clientId !== m.clientId))}>Remover</Button>
        </div>
      ))}
      <div className="members-row">
        <select className="select" id="members" aria-label="Perfil para adicionar" value={clientId} onChange={(e) => setClientId(e.target.value)}
          aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'members-err' : undefined}>
          <option value="">Selecione um perfil</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <RoleSelect label="Nível de acesso para adicionar" value={role} onChange={setRole} />
        <Button variant="ghost" onClick={add}>Adicionar</Button>
      </div>
      {error && <p className="errmsg" id="members-err" style={{ margin: 0 }}>{error}</p>}
    </fieldset>
  );
}
