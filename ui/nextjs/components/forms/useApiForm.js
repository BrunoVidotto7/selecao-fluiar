'use client';
import { useEffect, useRef, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { validateAll } from '@/lib/validation';
import { useToast, flash } from '../feedback/Feedback';

const VALIDATION_DETAIL = 'Revise os campos destacados.';
const SAVE_FAILED_DETAIL = 'Não conseguimos salvar agora. Tente novamente.';
const FORM_FIELD_SELECTOR = 'input[id], select[id], textarea[id]';

function focusFirstError(errors) {
  for (const name of Object.keys(errors)) {
    const input = document.getElementById(name);
    if (input) {
      input.focus();
      return;
    }
  }
}

function fieldValue(name, values) {
  if (Object.hasOwn(values, name)) return values[name];
  // Nested rows can use input IDs instead of top-level form keys.
  return document.getElementById(name)?.value;
}

function retainUnchangedServerErrors(errors, values) {
  const remaining = Object.entries(errors).filter(([name, error]) => Object.is(error.value, fieldValue(name, values)));
  return remaining.length === Object.keys(errors).length ? errors : Object.fromEntries(remaining);
}

/**
 * @template T
 * @param {{ initial?: Object, rules?: Object, validate?: (values: Object) => Record<string, string>,
 *   action: (values: Object) => Promise<import('@/lib/api.server').ActionResult<T>>,
 *   fieldMap?: Object | ((values: Object) => Record<string, string>),
 *   onSuccess?: (data: T, values: Object, feedback: Object) => void | Promise<void> }} options
 */
export default function useApiForm({ initial = {}, rules = {}, validate, action, fieldMap = {}, onSuccess }) {
  const [values, updateValues] = useState(initial);
  const [visibleLocalErrors, setVisibleLocalErrors] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const currentValues = useRef(initial);
  const pending = useRef(false);
  const mounted = useRef(true);
  const showToast = useToast();
  const router = useRouter();
  const errors = { ...visibleLocalErrors, ...Object.fromEntries(Object.entries(serverErrors).map(([name, error]) => [name, error.message])) };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setServerErrors((previous) => retainUnchangedServerErrors(previous, values));
  }, [values]);

  const toast = (message, type) => {
    if (mounted.current) showToast(message, type);
  };
  const go = (url, message) => {
    if (!mounted.current) return;
    if (message) flash(message);
    router.push(url);
    router.refresh();
  };

  const localErrors = (next) => {
    const ordinary = validateAll(next, rules);
    const additional = Object.fromEntries(Object.entries(validate?.(next) || {}).filter(([, message]) => message));
    return { ...ordinary, ...additional };
  };

  const setValues = (update) => {
    const next = typeof update === 'function' ? update(currentValues.current) : update;
    currentValues.current = next;
    updateValues(next);
    const nextErrors = localErrors(next);
    setVisibleLocalErrors((visible) => Object.fromEntries(Object.keys({ ...visible, ...serverErrors }).map((name) => [name, nextErrors[name] || ''])));
    setServerErrors((previous) => retainUnchangedServerErrors(previous, next));
  };
  const setValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const field = (name) => ({
    id: name,
    name,
    value: values[name] ?? '',
    error: errors[name],
    onChange: (event) => setValue(name, event.target.value),
    onBlur: () => {
      if (currentValues.current[name] || errors[name]) {
        const message = localErrors(currentValues.current)[name] || '';
        setVisibleLocalErrors((visible) => ({ ...visible, [name]: message }));
      }
    },
  });

  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;

    const submittedValues = currentValues.current;
    const validationErrors = localErrors(submittedValues);
    setServerErrors({});
    setVisibleLocalErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      focusFirstError(validationErrors);
      toast(VALIDATION_DETAIL, 'err');
      return;
    }

    const submittedFieldMap = typeof fieldMap === 'function' ? fieldMap(submittedValues) : fieldMap;
    const submittedInputs = event.currentTarget?.querySelectorAll(FORM_FIELD_SELECTOR) || [];
    const submittedFieldNames = new Set([
      ...Object.keys(submittedValues), ...Object.values(submittedFieldMap), ...Array.from(submittedInputs, (input) => input.id),
    ]);
    const submittedFieldValues = Object.fromEntries(Array.from(submittedFieldNames, (name) => [name, fieldValue(name, submittedValues)]));
    pending.current = true;
    setBusy(true);
    try {
      const result = await action(submittedValues);
      if (!mounted.current) return;
      if (!result.ok) {
        const mappedErrors = Object.fromEntries(Object.entries(result.errors).map(([name, message]) => {
          const fieldName = submittedFieldMap[name] || name;
          return [fieldName, { message, value: submittedFieldValues[fieldName] }];
        }));
        const unchangedErrors = retainUnchangedServerErrors(mappedErrors, currentValues.current);
        setServerErrors(unchangedErrors);
        focusFirstError(unchangedErrors);
        toast(result.detail, 'err');
        return;
      }
      await onSuccess?.(result.data, submittedValues, { go, toast });
    } catch (error) {
      unstable_rethrow(error);
      toast(SAVE_FAILED_DETAIL, 'err');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { values, setValue, setValues, errors, busy, field, submit };
}
