import { plexTv } from './client';
import type { Connection, Resource, ServerConn } from './types';

export async function listServers(token: string): Promise<Resource[]> {
	const devices = await plexTv<Resource[]>('/resources', {
		token,
		query: { includeHttps: 1, includeRelay: 1, includeIPv6: 1 }
	});
	return devices.filter((d) => d.provides.split(',').includes('server'));
}

// Prefer LAN, then direct remote, then Plex relay (bandwidth-capped); IPv4 before IPv6.
function rank(c: Connection): number {
	return (c.relay ? 4 : c.local ? 0 : 2) + (c.IPv6 ? 1 : 0);
}

async function probe(uri: string, token: string): Promise<boolean> {
	try {
		const res = await fetch(`${uri}/identity`, {
			headers: { Accept: 'application/json', 'X-Plex-Token': token },
			signal: AbortSignal.timeout(6000)
		});
		return res.ok;
	} catch {
		return false;
	}
}

/** Probe every connection in parallel and take the best-ranked one that answers. */
export async function connect(resource: Resource, userToken: string): Promise<ServerConn> {
	const token = resource.accessToken ?? userToken;
	let conns = [...resource.connections];
	// An https page can't call http servers (mixed content), so only plex.direct https URLs qualify.
	if (location.protocol === 'https:') conns = conns.filter((c) => c.protocol === 'https');
	conns.sort((a, b) => rank(a) - rank(b));

	const probes = conns.map((c) => probe(c.uri, token));
	for (let i = 0; i < conns.length; i++) {
		if (await probes[i]) {
			const c = conns[i];
			return {
				name: resource.name,
				clientIdentifier: resource.clientIdentifier,
				uri: c.uri,
				token,
				owned: resource.owned,
				local: c.local,
				relay: c.relay
			};
		}
	}
	throw new Error(`Couldn't reach ${resource.name} on any of its ${conns.length} addresses.`);
}
