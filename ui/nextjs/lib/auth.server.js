import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './api.server';
import { getHomePath } from './auth-routing';

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') redirect(getHomePath(user));
  return user;
}

export async function requireClient() {
  const user = await getCurrentUser();
  if (user.role !== 'CLIENT') redirect(getHomePath(user));
  return user;
}
