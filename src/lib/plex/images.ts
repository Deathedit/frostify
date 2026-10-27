import { session } from '#lib/stores/session.svelte.js';

/** Server-resized image URL for a Plex image path (thumb/art), sized for the device pixel ratio. */
export function img(path: string | undefined, width: number, height: number): string | undefined {
	const server = session.server;
	if (!path || !server) return undefined;
	const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
	const params = new URLSearchParams({
		width: String(Math.round(width * dpr)),
		height: String(Math.round(height * dpr)),
		minSize: '1',
		upscale: '1',
		url: path,
		'X-Plex-Token': server.token
	});
	return `${server.uri}/photo/:/transcode?${params}`;
}
