import 'server-only';
import { requestUrl, API_TIMEOUT_MS } from './api.server';
import { getAccessToken } from './session.server';
import { isUuid } from './route-input';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const PRIVATE_CACHE = 'private, no-store';
// An image id never changes its bytes: a new image gets a new id.
const IMAGE_CACHE = 'private, max-age=31536000, immutable';
const NOT_FOUND_DETAIL = 'Não encontramos o que você procurava.';
const LOGIN_DETAIL = 'Entre na sua conta para continuar.';
const CONNECTION_DETAIL = 'Não conseguimos conectar à API. Tente novamente.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';

function problem(status, detail) {
  return new Response(JSON.stringify({ type: 'about:blank', status, detail }), {
    status, headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': PRIVATE_CACHE },
  });
}

export async function readProductImage(imageId) {
  if (!isUuid(imageId)) return problem(404, NOT_FOUND_DETAIL);
  const token = await getAccessToken();
  if (!token) return problem(401, LOGIN_DETAIL);
  const url = requestUrl(`/api/images/${imageId}`);
  try {
    const response = await fetch(url.href, {
      headers: new Headers({ Authorization: `Bearer ${token}` }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (response.status === 401) return problem(401, LOGIN_DETAIL);
    if (response.status === 404) return problem(404, NOT_FOUND_DETAIL);
    if (!response.ok) return problem(503, CONNECTION_DETAIL);
    const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(type)) return problem(502, INVALID_RESPONSE_DETAIL);
    return new Response(await response.arrayBuffer(), {
      status: 200, headers: { 'Content-Type': type, 'Cache-Control': IMAGE_CACHE },
    });
  } catch {
    return problem(503, CONNECTION_DETAIL);
  }
}
