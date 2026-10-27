import { session } from '#lib/stores/session.svelte.js';
import type { MediaContainer } from './types';

export const PRODUCT = 'Frostify';
export const VERSION = '0.1.0';
const PLEX_TV = 'https://plex.tv/api/v2';

let cachedClientId: string | null = null;

/** Stable per-browser id; Plex uses it to tie PINs, sessions and devices together. */
export function clientId(): string {
	if (cachedClientId) return cachedClientId;
	try {
		cachedClientId = localStorage.getItem('frostify.clientId');
		if (!cachedClientId) {
			cachedClientId = crypto.randomUUID();
			localStorage.setItem('frostify.clientId', cachedClientId);
		}
	} catch {
		cachedClientId ??= crypto.randomUUID();
	}
	return cachedClientId;
}

function platform(): string {
	const ua = navigator.userAgent;
	if (/Firefox\//.test(ua)) return 'Firefox';
	if (/Edg\//.test(ua)) return 'Microsoft Edge';
	if (/Chrome\//.test(ua)) return 'Chrome';
	if (/Safari\//.test(ua)) return 'Safari';
	return 'Chrome';
}

/** X-Plex-* identification, usable as headers or as query params on media URLs. */
export function plexParams(token?: string | null): Record<string, string> {
	const params: Record<string, string> = {
		'X-Plex-Product': PRODUCT,
		'X-Plex-Version': VERSION,
		'X-Plex-Client-Identifier': clientId(),
		'X-Plex-Platform': platform(),
		'X-Plex-Device': platform(),
		'X-Plex-Device-Name': `${PRODUCT} (${platform()})`,
		'X-Plex-Model': 'hosted',
		'X-Plex-Language': navigator.language || 'en'
	};
	if (token) params['X-Plex-Token'] = token;
	return params;
}

export class PlexError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

type Query = Record<string, string | number | boolean | undefined>;

function toSearch(query?: Query): string {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(query ?? {})) {
		if (v !== undefined) params.set(k, String(v));
	}
	const s = params.toString();
	return s ? `?${s}` : '';
}

async function request<T>(url: string, init: RequestInit & { token?: string | null }): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: { Accept: 'application/json', ...plexParams(init.token), ...init.headers }
	});
	if (!res.ok) {
		throw new PlexError(res.status, `${res.status} ${res.statusText || 'Request failed'}`);
	}
	const text = await res.text();
	return (text ? JSON.parse(text) : {}) as T;
}

/** Call the plex.tv account API. */
export function plexTv<T>(
	path: string,
	opts: { method?: string; token?: string | null; query?: Query } = {}
): Promise<T> {
	return request<T>(`${PLEX_TV}${path}${toSearch(opts.query)}`, {
		method: opts.method ?? 'GET',
		token: opts.token
	});
}

function requireServer() {
	if (!session.server) throw new PlexError(0, 'No server selected');
	return session.server;
}

type PmsOptions = { method?: string; query?: Query; signal?: AbortSignal };

/** Call the selected Plex Media Server and return the whole JSON body. */
export function pmsRaw<T>(path: string, opts: PmsOptions = {}): Promise<T> {
	const server = requireServer();
	return request<T>(`${server.uri}${path}${toSearch(opts.query)}`, {
		method: opts.method ?? 'GET',
		token: server.token,
		signal: opts.signal
	});
}

/** Call the selected Plex Media Server; returns the MediaContainer body. */
export async function pms<T = MediaContainer>(path: string, opts: PmsOptions = {}): Promise<T> {
	const body = await pmsRaw<{ MediaContainer?: T }>(path, opts);
	return (body.MediaContainer ?? {}) as T;
}

/** Absolute URL to a server resource with auth in the query string, for <video>/<img> src. */
export function pmsUrl(path: string, query?: Query): string {
	const server = requireServer();
	const sep = path.includes('?') ? '&' : '?';
	const params = toSearch({ ...plexParams(server.token), ...query }).slice(1);
	return `${server.uri}${path}${sep}${params}`;
}
