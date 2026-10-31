'use client';
// Estado + validação visual de um formulário de protótipo.
// Uso: const f = useDemoForm({ initial, rules, onSuccess }); <input {...f.field('email')} />
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateAll, validateField } from '@/lib/validation';
import { useToast, flash } from '../feedback/Feedback';

export default function useDemoForm({ initial = {}, rules = {}, onSuccess }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const setValue = (name, v) => {
    setValues((s) => {
      const next = { ...s, [name]: v };
      if (errors[name]) setErrors((er) => ({ ...er, [name]: validateField(name, next, rules[name]) }));
      return next;
    });
  };

  const field = (name) => ({
    id: name,
    name,
    value: values[name] ?? '',
    error: errors[name],
    onChange: (e) => setValue(name, e.target.value),
    onBlur: () => { if (values[name] || errors[name]) setErrors((er) => ({ ...er, [name]: validateField(name, values, rules[name]) })); },
  });

  const submit = (e) => {
    e.preventDefault();
    const er = validateAll(values, rules);
    setErrors(er);
    const first = Object.keys(rules).find((k) => er[k]);
    if (first) { document.getElementById(first)?.focus(); toast('Revise os campos destacados.', 'err'); return; }
    setBusy(true);
    // simula o tempo de resposta do servidor
    setTimeout(() => {
      setBusy(false);
      onSuccess?.(values, { go: (url, msg) => { if (msg) flash(msg); router.push(url); }, toast });
    }, 650);
  };

  return { values, setValue, setValues, errors, busy, field, submit };
}
