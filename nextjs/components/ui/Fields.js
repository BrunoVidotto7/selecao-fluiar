'use client';
import { useState } from 'react';
import Icon from './Icon';
import { passwordStrength } from '@/lib/validation';

export function Field({ id, label, labelRight, optional, hint, error, children, as = 'label' }) {
  const Lbl = as;
  const lbl = <Lbl {...(as === 'label' ? { htmlFor: id } : { className: 'lbl', id: `${id}-l` })}>{label}{optional && <span className="opt"> (opcional)</span>}</Lbl>;
  return (
    <div className={'field' + (error ? ' invalid' : '')}>
      {labelRight ? <div className="lbl-row">{lbl}{labelRight}</div> : lbl}
      {children}
      {hint && <p className="hint" style={{ margin: 0 }}>{hint}</p>}
      {error && <p className="errmsg" id={`${id}-err`} style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

const aria = (id, error) => ({ 'aria-invalid': error ? 'true' : 'false', 'aria-describedby': error ? `${id}-err` : undefined });

export function TextInput({ label, labelRight, hint, optional, error, prefix, id, ...props }) {
  const input = <input className="input" id={id} {...aria(id, error)} {...props} />;
  return (
    <Field id={id} label={label} labelRight={labelRight} hint={hint} optional={optional} error={error}>
      {prefix ? <div className="affix"><span className="pre">{prefix}</span>{input}</div> : input}
    </Field>
  );
}

export function Select({ label, hint, error, id, placeholder, options, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select className="select" id={id} {...aria(id, error)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </Field>
  );
}

export function Textarea({ label, hint, optional, error, id, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} optional={optional} error={error}>
      <textarea className="textarea" id={id} {...aria(id, error)} {...props} />
    </Field>
  );
}

const STRENGTH_TEXT = ['Use pelo menos 8 caracteres, com letras e números.', 'Senha fraca', 'Senha razoável', 'Senha forte'];

export function PasswordInput({ label, labelRight, error, id, showStrength, ...props }) {
  const [show, setShow] = useState(false);
  const level = showStrength ? passwordStrength(props.value) : 0;
  return (
    <Field id={id} label={label} labelRight={labelRight} error={error}>
      <div className="affix">
        <input className="input" id={id} type={show ? 'text' : 'password'} {...aria(id, error)} {...props} style={{ paddingRight: 46 }} />
        <button type="button" className="pw iconbtn" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
          <Icon name={show ? 'eyeoff' : 'eye'} />
        </button>
      </div>
      {showStrength && <>
        <div className="strength" data-l={level} aria-hidden="true"><i /><i /><i /></div>
        <p className="hint" style={{ margin: 0 }}>{STRENGTH_TEXT[level]}</p>
      </>}
    </Field>
  );
}

// Controle segmentado em pílula (filtros e status)
export function Segmented({ options, value, onChange, label, radio, name }) {
  if (radio) {
    return (
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <span key={o.value} style={{ display: 'contents' }}>
            <input type="radio" name={name} id={`${name}-${o.value}`} checked={value === o.value} onChange={() => onChange(o.value)} />
            <label htmlFor={`${name}-${o.value}`}>{o.label}</label>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <span className="n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ id, label, ...props }) {
  return (
    <label className="search">
      <span className="sr">{label}</span><Icon name="search" />
      <input className="input" id={id} type="search" {...props} />
    </label>
  );
}
