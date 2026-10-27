import type { PlexUser, ServerConn } from '#lib/plex/types.js';

const PREFIX = 'frostify.';

function read<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		if (value === null) localStorage.removeItem(PREFIX + key);
		else localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// storage unavailable (private mode etc.) — session just won't persist
	}
}

/** Signed-in Plex account and the server we're talking to, persisted to localStorage. */
class Session {
	token = $state<string | null>(read('token'));
	user = $state<PlexUser | null>(read('user'));
	server = $state<ServerConn | null>(read('server'));

	signIn(token: string, user: PlexUser) {
		this.token = token;
		this.user = user;
		write('token', token);
		write('user', user);
	}

	setServer(server: ServerConn | null) {
		this.server = server;
		write('server', server);
	}

	signOut() {
		this.token = null;
		this.user = null;
		write('token', null);
		write('user', null);
		this.setServer(null);
	}
}

export const session = new Session();
