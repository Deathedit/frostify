import type { Metadata } from '#lib/plex/types.js';

export function duration(ms: number | undefined): string {
	if (!ms) return '';
	const mins = Math.round(ms / 60000);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return h ? `${h}h ${m}m` : `${m}m`;
}

export function clock(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
	const s = Math.floor(seconds % 60);
	const m = Math.floor((seconds / 60) % 60);
	const h = Math.floor(seconds / 3600);
	const pad = (n: number) => String(n).padStart(2, '0');
	return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function progress(item: Metadata): number {
	if (!item.viewOffset || !item.duration) return 0;
	return Math.min(1, item.viewOffset / item.duration);
}

export function episodeCode(item: Metadata): string {
	if (item.type !== 'episode') return '';
	return `S${item.parentIndex ?? '?'} · E${item.index ?? '?'}`;
}

/** Primary heading for a card: episodes are named after their show. */
export function displayTitle(item: Metadata): string {
	if (item.type === 'episode') return item.grandparentTitle ?? item.title;
	if (item.type === 'season') return item.parentTitle ?? item.title;
	return item.title;
}

export function subtitle(item: Metadata): string {
	switch (item.type) {
		case 'episode':
			return `${episodeCode(item)} — ${item.title}`;
		case 'season':
			return item.title;
		case 'show': {
			const n = item.childCount;
			return [item.year, n ? `${n} season${n === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
		}
		default:
			return [item.year, duration(item.duration)].filter(Boolean).join(' · ');
	}
}

export function unwatchedCount(item: Metadata): number {
	if (item.leafCount === undefined) return 0;
	return item.leafCount - (item.viewedLeafCount ?? 0);
}
