import { PRODUCT, clientId, plexTv } from './client';
import type { PlexUser } from './types';

interface Pin {
	id: number;
	code: string;
	authToken: string | null;
	expiresAt?: string;
}

export function createPin(): Promise<Pin> {
	return plexTv<Pin>('/pins', { method: 'POST', query: { strong: true } });
}

/** URL of Plex's hosted sign-in page for this PIN. */
export function authAppUrl(code: string, forwardUrl?: string): string {
	const params = new URLSearchParams({
		clientID: clientId(),
		code,
		'context[device][product]': PRODUCT
	});
	if (forwardUrl) params.set('forwardUrl', forwardUrl);
	return `https://app.plex.tv/auth#?${params}`;
}

/** Poll the PIN until the user approves it; resolves with the account token. */
export async function waitForPin(id: number, signal: AbortSignal): Promise<string> {
	const deadline = Date.now() + 10 * 60_000;
	while (!signal.aborted && Date.now() < deadline) {
		const pin = await plexTv<Pin>(`/pins/${id}`);
		if (pin.authToken) return pin.authToken;
		await new Promise((r) => setTimeout(r, 1500));
	}
	throw new Error(signal.aborted ? 'Sign-in cancelled' : 'Sign-in timed out');
}

export function getUser(token: string): Promise<PlexUser> {
	return plexTv<PlexUser>('/user', { token });
}
