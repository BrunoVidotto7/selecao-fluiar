import 'server-only';
import { revalidatePath } from 'next/cache';

/** @returns {void} */
export function revalidateWorkspaceData() {
  revalidatePath('/dashboard');
  revalidatePath('/minhas-listas');
  revalidatePath('/minhas-listas/[id]', 'layout');
  revalidatePath('/clientes');
  revalidatePath('/clientes/[id]', 'layout');
  revalidatePath('/listas');
  revalidatePath('/listas/[id]', 'layout');
}
