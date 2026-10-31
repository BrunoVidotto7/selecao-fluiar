import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getAccessToken } from './session.server';

const API_TIMEOUT_MS = 15_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const CONNECTION_DETAIL = 'Não conseguimos conectar à API. Tente novamente.';
const INVALID_RESPONSE_DETAIL = 'A API retornou uma resposta inválida.';
const REQUEST_FAILED_DETAIL = 'Não foi possível concluir a solicitação.';
const API_CONFIGURATION_DETAIL = 'Configure NEXT_PUBLIC_API_URL com a origem HTTP(S) da API.';
const PUBLIC_API_PATH = /^\/api\/(?:auth|public|images)(?:\/|$)/;
const API_LOGIN_PATH = '/api/auth/login';
const LOGIN_PATH = '/login';

/**
 * @template T
 * @typedef {{ ok: true, data: T } | { ok: false, status: number, detail: string, errors: Record<string, string> }} ActionResult
 */

/** @typedef {{ id: string, name: string, email: string, officeId: string, officeName: string }} MeResponse */

export class ApiError extends Error {
  constructor(status, detail, errors = {}) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

function requestUrl(path) {
  let origin;
  try {
    origin = new URL(process.env.NEXT_PUBLIC_API_URL);
  } catch {
    throw new Error(API_CONFIGURATION_DETAIL);
  }

  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error(API_CONFIGURATION_DETAIL);
  }

  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\s\\]/.test(path)) {
    throw new TypeError('Use um caminho da API iniciado por uma única barra.');
  }

  const url = new URL(path, origin.origin);
  if (url.origin !== origin.origin) {
    throw new TypeError('O caminho deve pertencer à origem configurada da API.');
  }
  return url;
}

async function responseData(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new ApiError(HTTP_SERVICE_UNAVAILABLE, CONNECTION_DETAIL);
  }

  if (!text && response.ok) return undefined;

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      response.ok ? HTTP_BAD_GATEWAY : HTTP_SERVICE_UNAVAILABLE,
      response.ok ? INVALID_RESPONSE_DETAIL : CONNECTION_DETAIL,
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.detail || REQUEST_FAILED_DETAIL, data?.errors || {});
  }
  return data;
}

/**
 * @template T
 * @param {string} path
 * @param {{ method?: string, body?: Object | FormData, auth?: 'required' | 'public' }} options
 * @returns {Promise<T | undefined>}
 */
export async function apiRequest(path, { method = 'GET', body, auth = 'required' } = {}) {
  const url = requestUrl(path);
  const headers = new Headers();
  if (auth !== 'public' && !PUBLIC_API_PATH.test(url.pathname)) {
    const token = await getAccessToken();
    if (!token) redirect(LOGIN_PATH);
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isJson = body !== undefined && !(body instanceof FormData);
  if (isJson) headers.set('Content-Type', 'application/json');
  const requestBody = isJson ? JSON.stringify(body) : body;
  const signal = AbortSignal.timeout(API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url.href, {
      method, headers, body: requestBody, signal, cache: 'no-store', redirect: 'error',
    });
  } catch {
    throw new ApiError(HTTP_SERVICE_UNAVAILABLE, CONNECTION_DETAIL);
  }

  const rejectedLogin = method === 'POST' && url.pathname === API_LOGIN_PATH;
  if (response.status === HTTP_UNAUTHORIZED && !rejectedLogin) redirect(LOGIN_PATH);
  return responseData(response);
}

/**
 * @template T
 * @param {string} path
 * @param {{ method?: string, body?: Object | FormData, auth?: 'required' | 'public' }} [options]
 * @returns {Promise<T | undefined>}
 */
export async function readApi(path, options) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) notFound();
    throw error;
  }
}

/**
 * @template T
 * @param {() => Promise<T>} work
 * @returns {Promise<ActionResult<T>>}
 */
export async function actionResult(work) {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, status: error.status, detail: error.detail, errors: error.errors };
  }
}

/** @returns {Promise<MeResponse>} */
export const getCurrentUser = cache(() => apiRequest('/api/me'));
