'use server';
import { actionResult, ApiError, apiRequest } from '@/lib/api.server';
import { isUuid } from '@/lib/route-input';
import { revalidateWorkspaceData } from '@/lib/revalidate.server';
import { LIST_ROLE_LABELS } from '@/lib/list-roles';

const HTTP_BAD_REQUEST = 400;
const INVALID_INPUT_DETAIL = 'Revise os dados enviados.';

function requireListId(id) {
  if (!isUuid(id)) throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
}

const OPTIONAL_TEXT_FIELDS = ['description', 'projectCode', 'contract', 'contractorName', 'contractorDocument', 'siteZipCode', 'siteAddress'];
const MEMBER_ROLES = Object.keys(LIST_ROLE_LABELS);

const validMember = (member) => member && typeof member === 'object' && !Array.isArray(member)
  && isUuid(member.clientId) && MEMBER_ROLES.includes(member.role);

function listBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.name !== 'string'
      || OPTIONAL_TEXT_FIELDS.some((field) => input[field] != null && typeof input[field] !== 'string')
      || !isUuid(input.clientId)
      || !Array.isArray(input.members) || !input.members.every(validMember)) {
    throw new ApiError(HTTP_BAD_REQUEST, INVALID_INPUT_DETAIL);
  }
  return {
    name: input.name,
    description: input.description ?? null,
    clientId: input.clientId,
    members: input.members.map(({ clientId, role }) => ({ clientId, role })),
    projectCode: input.projectCode ?? null,
    contract: input.contract ?? null,
    contractorName: input.contractorName ?? null,
    contractorDocument: input.contractorDocument ?? null,
    siteZipCode: input.siteZipCode ?? null,
    siteAddress: input.siteAddress ?? null,
  };
}

/**
 * @param {null | string} id
 * @param {{ name: string, description: null | string, clientId: string, members: { clientId: string, role: 'EDITOR' | 'READER' }[],
 *   projectCode: null | string, contract: null | string, contractorName: null | string, contractorDocument: null | string,
 *   siteZipCode: null | string, siteAddress: null | string }} input
 * @returns {Promise<import('@/lib/api.server').ActionResult<import('./queries.server').ListDetailResponse>>}
 */
export async function saveList(id, input) {
  return actionResult(async () => {
    if (id !== null) requireListId(id);
    const body = listBody(input);
    const list = await apiRequest(id === null ? '/api/lists' : `/api/lists/${id}`, {
      method: id === null ? 'POST' : 'PUT', body,
    });
    revalidateWorkspaceData();
    return list;
  });
}

/** @param {string} id @returns {Promise<import('@/lib/api.server').ActionResult<undefined>>} */
export async function deleteList(id) {
  return actionResult(async () => {
    requireListId(id);
    await apiRequest(`/api/lists/${id}`, { method: 'DELETE' });
    revalidateWorkspaceData();
  });
}
