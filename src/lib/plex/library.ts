import { pms } from './client';
import type { Hub, Metadata, Section } from './types';

export async function getSections(): Promise<Section[]> {
	const mc = await pms('/library/sections');
	return (mc.Directory ?? []).filter((d) => d.type === 'movie' || d.type === 'show');
}

function playableHubs(hubs: Hub[] | undefined): Hub[] {
	return (hubs ?? []).filter(
		(h) => h.Metadata?.length && h.Metadata.some((m) => ['movie', 'show', 'episode', 'season'].includes(m.type))
	);
}

export async function getHomeHubs(): Promise<Hub[]> {
	const mc = await pms('/hubs', { query: { count: 24, includeLibraryPlaylists: 0 } });
	return playableHubs(mc.Hub);
}

export async function getSectionHubs(sectionId: string): Promise<Hub[]> {
	const mc = await pms(`/hubs/sections/${sectionId}`, { query: { count: 24 } });
	return playableHubs(mc.Hub);
}

export const SORTS = [
	{ value: 'titleSort', label: 'A–Z' },
	{ value: 'addedAt:desc', label: 'Recently added' },
	{ value: 'originallyAvailableAt:desc', label: 'Release date' },
	{ value: 'audienceRating:desc', label: 'Rating' }
] as const;

export async function getSectionItems(
	sectionId: string,
	opts: { start: number; size: number; sort: string; unwatched: boolean }
): Promise<{ items: Metadata[]; total: number; title?: string }> {
	const mc = await pms(`/library/sections/${sectionId}/all`, {
		query: {
			sort: opts.sort,
			unwatched: opts.unwatched ? 1 : undefined,
			'X-Plex-Container-Start': opts.start,
			'X-Plex-Container-Size': opts.size
		}
	});
	return { items: mc.Metadata ?? [], total: mc.totalSize ?? mc.size ?? 0, title: mc.title1 };
}

export async function getMetadata(ratingKey: string): Promise<Metadata> {
	const mc = await pms(`/library/metadata/${ratingKey}`, { query: { includeOnDeck: 1 } });
	const item = mc.Metadata?.[0];
	if (!item) throw new Error('Item not found');
	return item;
}

export async function getChildren(ratingKey: string): Promise<Metadata[]> {
	return (await pms(`/library/metadata/${ratingKey}/children`)).Metadata ?? [];
}

export async function getAllLeaves(ratingKey: string): Promise<Metadata[]> {
	return (await pms(`/library/metadata/${ratingKey}/allLeaves`)).Metadata ?? [];
}

export async function search(query: string, signal?: AbortSignal): Promise<Metadata[]> {
	const mc = await pms('/hubs/search', { query: { query, limit: 30 }, signal });
	return (mc.Hub ?? [])
		.filter((h) => ['movie', 'show', 'episode'].includes(h.type))
		.flatMap((h) => h.Metadata ?? []);
}

/** Work out what "Play" should start for any item (a show plays its on-deck episode). */
export async function resolvePlayable(item: Metadata): Promise<string> {
	if (item.type === 'movie' || item.type === 'episode') return item.ratingKey;
	if (item.type === 'show') {
		const meta = await getMetadata(item.ratingKey);
		const onDeck = meta.OnDeck?.Metadata?.[0];
		if (onDeck) return onDeck.ratingKey;
	}
	const leaves = await getAllLeaves(item.ratingKey);
	const next = leaves.find((e) => !e.viewCount) ?? leaves[0];
	if (!next) throw new Error('Nothing to play');
	return next.ratingKey;
}

export async function markWatched(ratingKey: string, watched: boolean) {
	await pms(watched ? '/:/scrobble' : '/:/unscrobble', {
		query: { identifier: 'com.plexapp.plugins.library', key: ratingKey }
	});
}
