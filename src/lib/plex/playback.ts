import { session } from '#lib/stores/session.svelte.js';
import { pms, pmsUrl } from './client';
import type { Media, Metadata, Stream } from './types';

export const QUALITIES = [
	{ id: 'original', label: 'Original', bitrate: undefined, resolution: undefined },
	{ id: '20', label: '1080p · 20 Mbps', bitrate: 20000, resolution: '1920x1080' },
	{ id: '12', label: '1080p · 12 Mbps', bitrate: 12000, resolution: '1920x1080' },
	{ id: '8', label: '1080p · 8 Mbps', bitrate: 8000, resolution: '1920x1080' },
	{ id: '4', label: '720p · 4 Mbps', bitrate: 4000, resolution: '1280x720' },
	{ id: '2', label: '480p · 2 Mbps', bitrate: 2000, resolution: '720x480' }
] as const;
export type Quality = (typeof QUALITIES)[number];

// Ask the transcoder for something every browser + hls.js can decode.
const PROFILE_EXTRA = [
	'add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mpegts&videoCodec=h264&audioCodec=aac,mp3&replace=true)',
	'add-limitation(scope=videoCodec&scopeName=h264&type=upperBound&name=video.level&value=51&replace=true)',
	'add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.bitDepth&value=8&replace=true)'
].join('+');

export function streams(item: Metadata, type: Stream['streamType']): Stream[] {
	return item.Media?.[0]?.Part?.[0]?.Stream?.filter((s) => s.streamType === type) ?? [];
}

/** Can the browser play the file untouched? Only for common mp4/webm combos with no subtitles. */
export function canDirectPlay(item: Metadata, quality: Quality, video: HTMLVideoElement): boolean {
	const media: Media | undefined = item.Media?.[0];
	if (!media || quality.id !== 'original') return false;
	if (streams(item, 3).some((s) => s.selected)) return false;
	const container = media.container ?? '';
	const v = media.videoCodec ?? '';
	const a = media.audioCodec ?? '';
	if (['mp4', 'm4v', 'mov'].includes(container) && v === 'h264' && ['aac', 'mp3'].includes(a)) {
		return video.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"') !== '';
	}
	if (container === 'webm' && ['vp9', 'vp8', 'av1'].includes(v) && ['opus', 'vorbis'].includes(a)) {
		return video.canPlayType('video/webm') !== '';
	}
	return false;
}

export function directPlayUrl(item: Metadata): string {
	const part = item.Media?.[0]?.Part?.[0];
	if (!part) throw new Error('No playable media');
	return pmsUrl(part.key);
}

function transcodeQuery(item: Metadata, quality: Quality, sessionId: string) {
	const server = session.server!;
	return {
		hasMDE: 1,
		path: `/library/metadata/${item.ratingKey}`,
		mediaIndex: 0,
		partIndex: 0,
		protocol: 'hls',
		fastSeek: 1,
		directPlay: 0,
		directStream: quality.id === 'original' ? 1 : 0,
		directStreamAudio: 1,
		subtitles: 'burn',
		subtitleSize: 100,
		audioBoost: 100,
		location: server.local ? 'lan' : 'wan',
		copyts: 1,
		offset: 0,
		videoQuality: 100,
		maxVideoBitrate: quality.bitrate,
		videoResolution: quality.resolution,
		session: sessionId,
		'X-Plex-Session-Identifier': sessionId,
		'X-Plex-Client-Profile-Extra': PROFILE_EXTRA
	};
}

/** Ask the server to prepare an HLS stream; returns the master playlist URL. */
export async function startTranscode(item: Metadata, quality: Quality, sessionId: string): Promise<string> {
	const query = transcodeQuery(item, quality, sessionId);
	await pms('/video/:/transcode/universal/decision', { query });
	return pmsUrl('/video/:/transcode/universal/start.m3u8', query);
}

export function stopTranscode(sessionId: string) {
	return pms('/video/:/transcode/universal/stop', { query: { session: sessionId } }).catch(() => {});
}

export function reportTimeline(
	item: Metadata,
	state: 'playing' | 'paused' | 'stopped' | 'buffering',
	timeMs: number,
	sessionId: string
) {
	return pms('/:/timeline', {
		query: {
			ratingKey: item.ratingKey,
			key: `/library/metadata/${item.ratingKey}`,
			state,
			time: Math.round(timeMs),
			duration: item.duration,
			hasMDE: 1,
			'X-Plex-Session-Identifier': sessionId
		}
	}).catch(() => {});
}

export function selectStream(partId: number, kind: 'audio' | 'subtitle', streamId: number) {
	return pms(`/library/parts/${partId}`, {
		method: 'PUT',
		query: { [kind === 'audio' ? 'audioStreamID' : 'subtitleStreamID']: streamId, allParts: 1 }
	});
}
