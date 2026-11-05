import 'server-only';
import { revalidatePath } from 'next/cache';

/** @returns {void} */
export function revalidateWorkspaceData() {
  revalidatePath('/dashboard');
  revalidatePath('/my-lists');
  revalidatePath('/my-lists/[id]', 'layout');
  revalidatePath('/clientes');
  revalidatePath('/clientes/[id]', 'layout');
  revalidatePath('/listas');
  revalidatePath('/listas/[id]', 'layout');
}
