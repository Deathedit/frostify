import { redirect } from '@sveltejs/kit';
import { session } from '#lib/stores/session.svelte.js';

// Everything talks to Plex from the browser, so render client-side only.
export const ssr = false;
export const prerender = false;

const PUBLIC = ['/login'];

export function load({ url }) {
	const path = url.pathname;
	if (!session.token) {
		if (!PUBLIC.includes(path)) redirect(307, '/login');
	} else if (!session.server && path !== '/servers' && path !== '/login') {
		redirect(307, '/servers');
	}
}
