import 'server-only';
import { revalidatePath } from 'next/cache';

/** @returns {void} */
export function revalidateWorkspaceData() {
  revalidatePath('/dashboard');
  revalidatePath('/minhas-listas');
  revalidatePath('/minhas-listas/[id]', 'layout');
  revalidatePath('/perfis');
  revalidatePath('/perfis/[id]', 'layout');
  revalidatePath('/listas');
  revalidatePath('/listas/[id]', 'layout');
}
