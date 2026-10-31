import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import useApiForm from './useApiForm';
import Button from '../ui/Button';
import { TextInput } from '../ui/Fields';
import { FeedbackProvider } from '../feedback/Feedback';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => {
  const { unstable_rethrow } = await importOriginal();
  return {
    useRouter: () => ({ push, refresh }),
    usePathname: () => '/clientes',
    unstable_rethrow,
  };
});

const event = { preventDefault() {} };
const nameRule = { nome: { required: true } };
const phoneMessage = 'Digite o telefone com DDD, como (31) 99999-9999.';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function Form({ initial = { nome: 'Ana', tel: '31999998888' }, replaceLinks, ...options }) {
  const f = useApiForm({ initial, ...options });
  return (
    <form aria-label="Dados" onSubmit={f.submit} noValidate>
      <TextInput label="Nome" {...f.field('nome')} />
      <TextInput label="Telefone" {...f.field('tel')} />
      <TextInput label="E-mail" {...f.field('email')} />
      <TextInput label="Senha atual" type="password" {...f.field('atual')} />
      {f.values.links?.map((link, index) => (
        <TextInput key={index} id={`link-${index}-url`} label={`Link da loja ${index + 1}`}
          value={link.url} error={f.errors[`link-${index}-url`]}
          onChange={(e) => f.setValue('links', f.values.links.map((row, i) => i === index ? { ...row, url: e.target.value } : row))} />
      ))}
      {replaceLinks && <Button onClick={() => f.setValues((values) => ({ ...values, links: replaceLinks }))}>Corrigir links</Button>}
      <Button type="submit" busy={f.busy}>Salvar</Button>
    </form>
  );
}

function renderForm(options) {
  return render(<FeedbackProvider><Form {...options} /></FeedbackProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(() => sessionStorage.clear());

test('server errors focus the mapped field and do not navigate', async () => {
  const action = vi.fn().mockResolvedValue({
    ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { phone: phoneMessage },
  });
  const onSuccess = vi.fn();
  renderForm({ action, rules: nameRule, fieldMap: { name: 'nome', phone: 'tel' }, onSuccess });

  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));

  await waitFor(() => expect(document.activeElement.id).toBe('tel'));
  expect(screen.getByLabelText('Telefone').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText(phoneMessage)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

const serverOnlyFields = [
  ['email', 'email', 'E-mail', 'ana@example.com', 'Este e-mail já tem uma conta.', 409],
  ['currentPassword', 'atual', 'Senha atual', 'wrong-password', 'Senha atual incorreta.', 400],
];

test.each(serverOnlyFields)(
  'an unrelated value edit keeps the server-only %s error', async (apiName, name, label, value, message, status) => {
    renderForm({
      initial: { nome: 'Ana', [name]: value },
      rules: { ...nameRule, [name]: name === 'email' ? { email: true } : { required: true } },
      fieldMap: { [apiName]: name },
      action: vi.fn().mockResolvedValue({ ok: false, status, detail: 'Revise os campos destacados.', errors: { [apiName]: message } }),
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
    await waitFor(() => expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true'));

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });

    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(message)).toBeTruthy();
  },
);

test.each(serverOnlyFields)(
  'an unchanged blur keeps the server-only %s error', async (apiName, name, label, value, message, status) => {
    renderForm({
      initial: { nome: 'Ana', [name]: value },
      rules: { [name]: name === 'email' ? { email: true } : { required: true } },
      fieldMap: { [apiName]: name },
      action: vi.fn().mockResolvedValue({ ok: false, status, detail: 'Revise os campos destacados.', errors: { [apiName]: message } }),
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
    const input = screen.getByLabelText(label);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));

    fireEvent.blur(input);

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(message)).toBeTruthy();
  },
);

test('changing the rejected value removes its server error and still revalidates local syntax', async () => {
  renderForm({
    initial: { email: 'ana@example.com' }, rules: { email: { email: true } },
    action: vi.fn().mockResolvedValue({ ok: false, status: 409, detail: 'Revise os campos destacados.', errors: { email: 'Este e-mail já tem uma conta.' } }),
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  await waitFor(() => expect(screen.getByText('Este e-mail já tem uma conta.')).toBeTruthy());
  const email = screen.getByLabelText('E-mail');

  fireEvent.change(email, { target: { value: 'invalid' } });
  expect(screen.queryByText('Este e-mail já tem uma conta.')).toBeNull();
  expect(screen.getByText('Digite um e-mail válido, como nome@email.com.')).toBeTruthy();
  expect(email.getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(email, { target: { value: 'maria@example.com' } });
  expect(email.getAttribute('aria-invalid')).toBe('false');
});

test('setValues keeps server errors for unchanged values and clears only the changed rejected value', async () => {
  const { result } = renderHook(() => useApiForm({
    initial: { nome: 'Ana', email: 'ana@example.com' }, rules: { email: { email: true } },
    action: vi.fn().mockResolvedValue({ ok: false, status: 409, detail: 'Revise os campos destacados.', errors: { email: 'Este e-mail já tem uma conta.' } }),
  }));
  await act(async () => { await result.current.submit(event); });

  act(() => result.current.setValues({ nome: 'Maria', email: 'ana@example.com' }));
  expect(result.current.errors.email).toBe('Este e-mail já tem uma conta.');
  act(() => result.current.setValues((values) => ({ ...values })));
  expect(result.current.errors.email).toBe('Este e-mail já tem uma conta.');
  act(() => result.current.setValues((values) => ({ ...values, email: 'maria@example.com' })));
  expect(result.current.errors.email).toBeFalsy();
});

test('a nested server error survives unrelated edits but clears when its own row value changes', async () => {
  renderForm({
    initial: { nome: 'Ana', links: [{ url: 'https://example.com' }, { url: 'https://other.example.com' }] },
    fieldMap: { 'links[0].url': 'link-0-url' }, validate: () => ({}),
    action: vi.fn().mockResolvedValue({
      ok: false, status: 400, detail: 'Revise os campos destacados.',
      errors: { 'links[0].url': 'Cole o link completo, começando com https://' },
    }),
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  const rejectedLink = screen.getByLabelText('Link da loja 1');
  await waitFor(() => expect(rejectedLink.getAttribute('aria-invalid')).toBe('true'));

  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
  expect(rejectedLink.getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(screen.getByLabelText('Link da loja 2'), { target: { value: 'https://new.example.com' } });
  expect(rejectedLink.getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(rejectedLink, { target: { value: 'https://fixed.example.com' } });
  expect(rejectedLink.getAttribute('aria-invalid')).toBe('false');
});

test('a programmatic nested value replacement clears the corresponding server error after rendering', async () => {
  renderForm({
    initial: { links: [{ url: 'https://example.com' }] },
    replaceLinks: [{ url: 'https://fixed.example.com' }],
    fieldMap: { 'links[0].url': 'link-0-url' },
    action: vi.fn().mockResolvedValue({
      ok: false, status: 400, detail: 'Revise os campos destacados.',
      errors: { 'links[0].url': 'Cole o link completo, começando com https://' },
    }),
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  const link = screen.getByLabelText('Link da loja 1');
  await waitFor(() => expect(link.getAttribute('aria-invalid')).toBe('true'));

  fireEvent.click(screen.getByRole('button', { name: 'Corrigir links' }));

  expect(link.value).toBe('https://fixed.example.com');
  expect(link.getAttribute('aria-invalid')).toBe('false');
});

test('a server error for a submitted value already changed while awaiting the action does not invalidate its replacement', async () => {
  const pending = deferred();
  renderForm({ initial: { email: 'ana@example.com' }, action: () => pending.promise });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  const email = screen.getByLabelText('E-mail');
  fireEvent.change(email, { target: { value: 'maria@example.com' } });
  await act(async () => pending.resolve({
    ok: false, status: 409, detail: 'Este e-mail já tem uma conta.', errors: { email: 'Este e-mail já tem uma conta.' },
  }));

  expect(email.getAttribute('aria-invalid')).toBe('false');
  expect(screen.getByRole('status').textContent).toContain('Este e-mail já tem uma conta.');
});

test('another submission replaces the previous server errors while its action is pending', async () => {
  const pending = deferred();
  const action = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 409, detail: 'Revise os campos destacados.', errors: { email: 'Este e-mail já tem uma conta.' } })
    .mockImplementationOnce(() => pending.promise);
  renderForm({ initial: { email: 'ana@example.com' }, action });
  const form = screen.getByRole('form', { name: 'Dados' });
  fireEvent.submit(form);
  const email = screen.getByLabelText('E-mail');
  await waitFor(() => expect(email.getAttribute('aria-invalid')).toBe('true'));

  fireEvent.submit(form);
  expect(email.getAttribute('aria-invalid')).toBe('false');
  expect(screen.getByRole('button', { name: 'Salvar' }).disabled).toBe(true);
  await act(async () => pending.resolve({ ok: true, data: null }));
});

test('server errors still bind to rendered fields omitted from initial values and fieldMap', async () => {
  renderForm({
    initial: { nome: 'Ana' },
    action: vi.fn().mockResolvedValue({
      ok: false, status: 400, detail: 'Revise os campos destacados.', errors: { email: 'Preencha este campo.' },
    }),
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  const email = screen.getByLabelText('E-mail');
  await waitFor(() => expect(email.getAttribute('aria-invalid')).toBe('true'));

  fireEvent.blur(email);
  expect(email.getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(email, { target: { value: 'ana@example.com' } });
  expect(email.getAttribute('aria-invalid')).toBe('false');
});

test('an error without matching fields still shows upstream detail', async () => {
  const action = vi.fn().mockResolvedValue({
    ok: false, status: 409, detail: 'Este registro já existe.', errors: { unknown: 'Revise os dados enviados.' },
  });
  renderForm({ action });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Este registro já existe.'));
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Salvar' }).disabled).toBe(false);
});

test('invalid local input never calls the action and focuses the first visible invalid field', () => {
  const action = vi.fn();
  renderForm({
    action, initial: { nome: '', tel: '' }, rules: { ...nameRule, tel: { phone: true } },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement.id).toBe('nome');
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  expect(screen.getByText(phoneMessage)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Revise os campos destacados.');
  expect(action).not.toHaveBeenCalled();
});

test('ordinary validation and feature-specific nested errors both block submission', () => {
  const action = vi.fn();
  const validate = () => ({ 'link-0-url': 'Cole o link completo, começando com https://' });
  renderForm({ action, initial: { nome: '', links: [{ url: 'bad' }] }, rules: nameRule, validate });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Link da loja 1').getAttribute('aria-invalid')).toBe('true');
  expect(action).not.toHaveBeenCalled();
});

test('empty feature-validation messages do not block a valid submission', async () => {
  const action = vi.fn().mockResolvedValue({ ok: true, data: { id: 'saved' } });
  renderForm({ action, validate: () => ({ nome: '' }) });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('false');
  expect(screen.getByRole('status').textContent).toBe('');
});

test('empty feature-validation messages cannot clear ordinary validation errors', () => {
  const action = vi.fn();
  renderForm({ action, initial: { nome: '' }, rules: nameRule, validate: () => ({ nome: '' }) });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  expect(action).not.toHaveBeenCalled();
});

test('correcting a nested row recomputes its already-visible custom error', () => {
  const action = vi.fn();
  const validate = (values) => values.links[0].url.startsWith('https://')
    ? {} : { 'link-0-url': 'Cole o link completo, começando com https://' };
  renderForm({ action, initial: { nome: 'Ana', links: [{ url: 'bad' }] }, validate });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  expect(document.activeElement.id).toBe('link-0-url');
  const link = screen.getByLabelText('Link da loja 1');
  expect(link.getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(link, { target: { value: 'https://example.com' } });
  expect(link.getAttribute('aria-invalid')).toBe('false');
  expect(screen.queryByText('Cole o link completo, começando com https://')).toBeNull();
});

test('a changed value recomputes already-visible dependent rules', () => {
  const { result } = renderHook(() => useApiForm({
    initial: { senha: 'Password1', senha2: 'wrong' }, rules: { senha2: { match: 'senha' } }, action: vi.fn(),
  }));
  act(() => { result.current.submit(event); });
  expect(result.current.errors.senha2).toBe('As senhas não são iguais.');
  act(() => result.current.setValue('senha', 'wrong'));
  expect(result.current.errors.senha2).toBeFalsy();
});

test('setValues accepts replacements and functional updates while correcting visible errors', () => {
  const { result } = renderHook(() => useApiForm({ initial: { nome: '' }, rules: nameRule, action: vi.fn() }));
  act(() => { result.current.submit(event); });
  expect(result.current.errors.nome).toBe('Preencha este campo.');
  act(() => result.current.setValues({ nome: 'Ana' }));
  expect(result.current.values.nome).toBe('Ana');
  expect(result.current.errors.nome).toBeFalsy();
  act(() => result.current.setValues((values) => ({ ...values, nome: 'Maria' })));
  expect(result.current.values.nome).toBe('Maria');
});

test('blur validates filled input without showing errors for untouched empty fields', () => {
  renderForm({ action: vi.fn(), rules: { email: { required: true, email: true } } });
  const email = screen.getByLabelText('E-mail');
  fireEvent.blur(email);
  expect(email.getAttribute('aria-invalid')).toBe('false');
  fireEvent.change(email, { target: { value: 'ana@' } });
  expect(email.getAttribute('aria-invalid')).toBe('false');
  fireEvent.blur(email);
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Digite um e-mail válido, como nome@email.com.')).toBeTruthy();
  fireEvent.change(email, { target: { value: 'ana@example.com' } });
  expect(email.getAttribute('aria-invalid')).toBe('false');
});

test('duplicate submits invoke a pending action only once even before React renders busy', async () => {
  const pending = deferred();
  const action = vi.fn(() => pending.promise);
  const { result } = renderHook(() => useApiForm({ initial: { nome: 'Ana' }, rules: nameRule, action }));
  let submission;
  act(() => {
    submission = result.current.submit(event);
    result.current.submit(event);
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
  await act(async () => { pending.resolve({ ok: true, data: { id: 'saved' } }); await submission; });
  expect(result.current.busy).toBe(false);
  await act(async () => { await result.current.submit(event); });
  expect(action).toHaveBeenCalledTimes(2);
});

test('busy disables the actual submit button until the action settles', async () => {
  const pending = deferred();
  renderForm({ action: () => pending.promise });
  const button = screen.getByRole('button', { name: 'Salvar' });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.disabled).toBe(true);
  await act(async () => pending.resolve({ ok: true, data: null }));
  expect(button.disabled).toBe(false);
  expect(button.hasAttribute('aria-busy')).toBe(false);
});

test('Button busy cannot be overridden by disabled false and explicit disabled remains honored', () => {
  const { rerender } = render(<Button busy disabled={false}>Salvar</Button>);
  expect(screen.getByRole('button', { name: 'Salvar' }).disabled).toBe(true);
  rerender(<Button disabled>Salvar</Button>);
  expect(screen.getByRole('button', { name: 'Salvar' }).disabled).toBe(true);
});

test('an action rejection restores busy and shows fallback feedback without success', async () => {
  const onSuccess = vi.fn();
  renderForm({ action: vi.fn().mockRejectedValue(new Error('private technical details')), onSuccess });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Não conseguimos salvar agora. Tente novamente.'));
  expect(screen.getByRole('status').textContent).not.toContain('private technical details');
  expect(screen.getByRole('button', { name: 'Salvar' }).disabled).toBe(false);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('success awaits its callback and receives unchanged submitted values and feedback helpers', async () => {
  const pending = deferred();
  const saved = { id: 'saved' };
  const onSuccess = vi.fn(async (data, values, { go }) => {
    await pending.promise;
    go('/clientes', 'Cliente cadastrado.');
  });
  const { result } = renderHook(() => useApiForm({
    initial: { nome: 'Ana', senha: '  abc123  ' }, action: vi.fn().mockResolvedValue({ ok: true, data: saved }), onSuccess,
  }));
  let submission;
  await act(async () => { submission = result.current.submit(event); });
  expect(onSuccess).toHaveBeenCalledWith(saved, { nome: 'Ana', senha: '  abc123  ' }, { go: expect.any(Function), toast: expect.any(Function) });
  expect(result.current.busy).toBe(true);
  expect(push).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(); await submission; });
  expect(result.current.busy).toBe(false);
  expect(JSON.parse(sessionStorage.getItem('flash'))).toEqual({ m: 'Cliente cadastrado.' });
  expect(push).toHaveBeenCalledWith('/clientes');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(push.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
});

test('field maps use the submitted row snapshot, not rows edited while the action is pending', async () => {
  const pending = deferred();
  const action = vi.fn(() => pending.promise);
  const fieldMap = (values) => Object.fromEntries(values.links
    .map((row, index) => ({ row, index })).filter(({ row }) => row.url.trim())
    .map(({ index }, apiIndex) => [`links[${apiIndex}].url`, `link-${index}-url`]));
  renderForm({ action, initial: { nome: 'Ana', links: [{ url: '' }, { url: 'https://example.com' }] }, fieldMap });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  fireEvent.change(screen.getByLabelText('Link da loja 1'), { target: { value: 'https://new.example.com' } });
  await act(async () => pending.resolve({
    ok: false, status: 400, detail: 'Revise os campos destacados.',
    errors: { 'links[0].url': 'Cole o link completo, começando com https://' },
  }));
  expect(document.activeElement.id).toBe('link-1-url');
  expect(screen.getByLabelText('Link da loja 2').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Link da loja 1').getAttribute('aria-invalid')).toBe('false');
  expect(action).toHaveBeenCalledWith({ nome: 'Ana', links: [{ url: '' }, { url: 'https://example.com' }] });
});

test('unmount before an action resolves prevents success navigation', async () => {
  const pending = deferred();
  const onSuccess = vi.fn((data, values, { go }) => go('/clientes', 'Cliente cadastrado.'));
  const { result, unmount } = renderHook(() => useApiForm({ action: () => pending.promise, onSuccess }));
  let submission;
  act(() => { submission = result.current.submit(event); });
  unmount();
  await act(async () => { pending.resolve({ ok: true, data: null }); await submission; });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('unmount during an async success callback prevents late navigation and flash', async () => {
  const pending = deferred();
  const onSuccess = async (data, values, { go }) => { await pending.promise; go('/clientes', 'Cliente cadastrado.'); };
  const { result, unmount } = renderHook(() => useApiForm({
    action: vi.fn().mockResolvedValue({ ok: true, data: null }), onSuccess,
  }));
  let submission;
  await act(async () => { submission = result.current.submit(event); });
  expect(result.current.busy).toBe(true);
  unmount();
  await act(async () => { pending.resolve(); await submission; });
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('flash')).toBeNull();
});

test('unmount during an async success callback prevents late toast feedback', async () => {
  const pending = deferred();
  const onSuccess = vi.fn(async (data, values, { toast }) => {
    await pending.promise;
    toast('Cliente cadastrado.');
  });
  const view = renderForm({ action: vi.fn().mockResolvedValue({ ok: true, data: null }), onSuccess });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => pending.resolve());
  expect(screen.getByRole('status').textContent).toBe('');
});

test('an action rejection after unmount does not show a stale failure toast', async () => {
  const pending = deferred();
  const view = renderForm({ action: () => pending.promise });
  fireEvent.submit(screen.getByRole('form', { name: 'Dados' }));
  view.rerender(<FeedbackProvider><p>Outra tela</p></FeedbackProvider>);
  await act(async () => pending.reject(new Error('network failure')));
  expect(screen.getByRole('status').textContent).toBe('');
});

test.each(['NEXT_REDIRECT;replace;/login;307;', 'NEXT_HTTP_ERROR_FALLBACK;404'])(
  'Next navigation signals escape without becoming a save-failure toast: %s', async (digest) => {
    const signal = Object.assign(new Error('Next navigation'), { digest });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApiForm({
      action: vi.fn().mockRejectedValue(signal), onSuccess,
    }), { wrapper: FeedbackProvider });
    await act(async () => {
      await expect(result.current.submit(event)).rejects.toBe(signal);
    });
    expect(result.current.busy).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(onSuccess).not.toHaveBeenCalled();
  },
);
