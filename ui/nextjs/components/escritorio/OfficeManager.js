'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import useApiForm from '../forms/useApiForm';
import { renameOffice } from './actions';

const OFFICE_NAME_MAX_LENGTH = 120;

function RenameOfficeForm({ office }) {
  const router = useRouter();
  const confirmedName = useRef(office.name);
  const unacknowledgedName = useRef(null);
  const f = useApiForm({
    initial: { officeName: office.name },
    rules: { officeName: { required: true, maxLength: OFFICE_NAME_MAX_LENGTH } },
    fieldMap: { name: 'officeName' },
    action: ({ officeName }) => renameOffice({ name: officeName }),
    onSuccess: (data, submitted, { toast }) => {
      const supersededNames = new Set(unacknowledgedName.current?.supersededNames);
      supersededNames.add(confirmedName.current);
      unacknowledgedName.current = { name: data.name, supersededNames };
      confirmedName.current = data.name;
      f.setValues((current) => current.officeName === submitted.officeName
        ? { ...current, officeName: data.name }
        : current);
      toast('Escritório salvo.');
      router.refresh();
    },
  });
  const { busy, setValues } = f;
  useEffect(() => {
    if (busy) return;
    // Superseded server acknowledgments must not undo the latest saved name.
    const unacknowledged = unacknowledgedName.current;
    if (unacknowledged) {
      if (office.name !== unacknowledged.name && unacknowledged.supersededNames.has(office.name)) return;
      unacknowledgedName.current = null;
    }
    const previousName = confirmedName.current;
    if (office.name === previousName) return;
    confirmedName.current = office.name;
    setValues((current) => current.officeName === previousName
      ? { ...current, officeName: office.name }
      : current);
  }, [busy, office.name, setValues]);

  return (
    <form className="form" onSubmit={f.submit} noValidate>
      <TextInput label="Nome do escritório" autoComplete="organization" {...f.field('officeName')} />
      <div className="btns"><Button type="submit" busy={f.busy}>{f.busy ? 'Salvando…' : 'Salvar escritório'}</Button></div>
    </form>
  );
}

export default function OfficeManager({ office }) {
  return (
    <div className="settings">
      <section className="card setsec" aria-labelledby="office-title">
        <div className="about">
          <h2 className="sec" id="office-title">Dados do escritório</h2>
          <p>O nome do escritório aparece na assinatura das listas enviadas aos clientes.</p>
        </div>
        <RenameOfficeForm key={office.id} office={office} />
      </section>
      <section className="card setsec" aria-labelledby="members-title">
        <div className="about"><h2 className="sec" id="members-title">Membros</h2><p>Pessoas que compartilham os clientes e as listas deste escritório.</p></div>
        <ul className="rows office-rows">
          {office.members.map((member) => (
            <li key={member.id}><div className="office-person"><strong>{member.name}</strong><span className="meta">{member.email}</span></div></li>
          ))}
        </ul>
      </section>

    </div>
  );
}
