import { isLinkToken, isUuid } from './route-input';

const USER_FIELDS = ['id', 'name', 'email', 'officeId', 'officeName'];

export function getHomePath(user) {
  if (user?.role === 'ADMIN') return '/dashboard';
  if (user?.role === 'CLIENT') return '/minhas-listas';
  throw new TypeError('Unknown account role.');
}

export function safeReturnPath(value) {
  return typeof value === 'string' && value.startsWith('/l/') && isLinkToken(value.slice(3)) ? value : null;
}

export function getLoginPath(returnTo) {
  const target = safeReturnPath(returnTo);
  return target ? '/login?next=' + encodeURIComponent(target) : '/login';
}

export function parseAuthenticatedUser(user) {
  if (!user || USER_FIELDS.some((field) => typeof user[field] !== 'string' || !user[field].trim())
      || !isUuid(user.id) || !isUuid(user.officeId)
      || !((user.role === 'ADMIN' && user.clientId === null) || (user.role === 'CLIENT' && isUuid(user.clientId)))) {
    return null;
  }
  return { ...Object.fromEntries(USER_FIELDS.map((field) => [field, user[field]])), role: user.role, clientId: user.clientId };
}
