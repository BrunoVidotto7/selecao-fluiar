// Validação visual dos formulários (protótipo). Regras por campo:
// { required: true | 'mensagem', email: true, url: true, minLength: 8, match: 'outroCampo', requiredIf: 'outroCampo' }
export function validateField(name, values, rule = {}) {
  const v = String(values[name] ?? '').trim();
  if (rule.required && !v) return typeof rule.required === 'string' ? rule.required : 'Preencha este campo.';
  if (rule.requiredIf && !v && values[rule.requiredIf]) return 'Informe a senha atual para trocar a senha.';
  if (v && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Digite um e-mail válido, como nome@email.com.';
  if (v && rule.url && !/^https?:\/\/\S+\.\S+/.test(v)) return 'Cole o link completo, começando com https://';
  if (v && rule.minLength && v.length < rule.minLength) return `Use pelo menos ${rule.minLength} caracteres.`;
  if (rule.match && String(values[name] ?? '') !== String(values[rule.match] ?? '')) return 'As senhas não são iguais.';
  return '';
}

export function validateAll(values, rules) {
  const errors = {};
  for (const name of Object.keys(rules)) {
    const msg = validateField(name, values, rules[name]);
    if (msg) errors[name] = msg;
  }
  return errors;
}

export function passwordStrength(v) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d|[^\w]/.test(v) && v.length >= 10) s++;
  return Math.max(1, s);
}
