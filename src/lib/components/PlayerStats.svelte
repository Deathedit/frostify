<script lang="ts">
	import type Hls from 'hls.js';
	import { onMount } from 'svelte';
	import { clock } from '#lib/format.js';
	import {
		type Quality,
		type TranscodeDecision,
		type TranscodeSession,
		getTranscodeSession,
		streams
	} from '#lib/plex/playback.js';
	import type { Metadata, Stream } from '#lib/plex/types.js';
	import { session } from '#lib/stores/session.svelte.js';
	import Icon from './Icon.svelte';

	let {
		meta,
		mode,
		quality,
		decision,
		subtitleMode,
		sessionId,
		getVideo,
		getHls,
		onclose
	}: {
		meta: Metadata;
		mode: 'direct' | 'hls';
		quality: Quality;
		decision: TranscodeDecision | null;
		subtitleMode: 'off' | 'client' | 'burn';
		sessionId: string;
		getVideo: () => HTMLVideoElement;
		getHls: () => Hls | null;
		onclose: () => void;
	} = $props();

	// Client-side numbers, sampled once a second.
	let live = $state({
		width: 0,
		height: 0,
		dropped: 0,
		frames: 0,
		bufferAhead: 0,
		position: 0,
		duration: 0,
		bandwidth: 0,
		levelBitrate: 0,
		levelCodecs: '',
		viewport: ''
	});
	let transcoder = $state<TranscodeSession | null>(null);
	let transcoderDenied = $state(false);

	function sample() {
		const video = getVideo();
		const q = video.getVideoPlaybackQuality?.();
		let ahead = 0;
		for (let i = 0; i < video.buffered.length; i++) {
			if (video.buffered.start(i) <= video.currentTime + 0.5 && video.buffered.end(i) >= video.currentTime) {
				ahead = video.buffered.end(i) - video.currentTime;
			}
		}
		const hls = getHls();
		const level = hls && hls.currentLevel >= 0 ? hls.levels[hls.currentLevel] : undefined;
		live = {
			width: video.videoWidth,
			height: video.videoHeight,
			dropped: q?.droppedVideoFrames ?? 0,
			frames: q?.totalVideoFrames ?? 0,
			bufferAhead: ahead,
			position: video.currentTime,
			duration: Number.isFinite(video.duration) ? video.duration : (meta.duration ?? 0) / 1000,
			bandwidth: hls?.bandwidthEstimate ?? 0,
			levelBitrate: level?.bitrate ?? 0,
			levelCodecs: [level?.videoCodec, level?.audioCodec].filter(Boolean).join(', '),
			viewport: `${innerWidth}×${innerHeight} @${devicePixelRatio}x`
		};
	}

	onMount(() => {
		sample();
		const id = setInterval(sample, 1000);
		return () => clearInterval(id);
	});

	// Transcoder progress only exists for HLS sessions; poll it separately and less often.
	$effect(() => {
		if (mode !== 'hls') {
			transcoder = null;
			return;
		}
		const id = sessionId;
		let stopped = false;
		const poll = async () => {
			try {
				const s = await getTranscodeSession(id);
				if (!stopped) transcoder = s;
			} catch {
				// non-owners get 401 here; just hide that section
				if (!stopped) transcoderDenied = true;
			}
		};
		poll();
		const timer = setInterval(poll, 2000);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	});

	const media = $derived(meta.Media?.[0]);
	const part = $derived(media?.Part?.[0]);
	const srcVideo = $derived(streams(meta, 1)[0]);
	const srcAudio = $derived(streams(meta, 2).find((s) => s.selected) ?? streams(meta, 2)[0]);
	const srcSub = $derived(streams(meta, 3).find((s) => s.selected));

	function mbps(kbps: number | undefined): string {
		if (!kbps) return '—';
		return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`;
	}

	function size(bytes: number | undefined): string {
		if (!bytes) return '—';
		const gb = bytes / 1024 ** 3;
		return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
	}

	function channels(n: number | undefined): string {
		if (!n) return '';
		return ({ 1: 'mono', 2: 'stereo', 6: '5.1', 8: '7.1' } as Record<number, string>)[n] ?? `${n} ch`;
	}

	function streamLine(s: Stream | undefined): string {
		if (!s) return '—';
		return [s.codec?.toUpperCase(), s.width && s.height ? `${s.width}×${s.height}` : '', channels(s.channels)]
			.filter(Boolean)
			.join(' · ');
	}

	const server = $derived(session.server);
	const connection = $derived(
		server ? (server.relay ? 'Relay' : server.local ? 'LAN' : 'Remote') : '—'
	);
	// Plex pauses the transcoder (speed 0) once it's far enough ahead; that's healthy, not stalled.
	const transcoderAhead = $derived(
		transcoder?.maxOffsetAvailable && transcoder.maxOffsetAvailable - live.position > 5
			? transcoder.maxOffsetAvailable - live.position
			: 0
	);
	const droppedPct = $derived(live.frames ? (live.dropped / live.frames) * 100 : 0);
</script>

<aside class="stats" aria-label="Playback stats">
	<header>
		<strong>Playback stats</strong>
		<button aria-label="Close stats" onclick={onclose}><Icon name="close" /></button>
	</header>

	<dl>
		<dt class="section">Playback</dt>
		<dt>Mode</dt>
		<dd class:accent={mode === 'direct'}>
			{mode === 'direct' ? 'Direct play' : `HLS stream · ${quality.label}`}
		</dd>
		<dt>Server</dt>
		<dd>{server?.name ?? '—'} · {connection}</dd>
		<dt>Session</dt>
		<dd class="mono">{sessionId.slice(0, 8)}</dd>
		<dt>Position</dt>
		<dd class="mono">{clock(live.position)} / {clock(live.duration)}</dd>

		<dt class="section">Source file</dt>
		<dt>Container</dt>
		<dd>{media?.container?.toUpperCase() ?? '—'} · {size(part?.size)}</dd>
		<dt>Video</dt>
		<dd>
			{media?.videoCodec?.toUpperCase() ?? '—'}
			{#if media?.videoProfile}· {media.videoProfile}{/if}
			{#if media?.width}· {media.width}×{media.height}{/if}
			{#if media?.videoFrameRate}· {media.videoFrameRate}{/if}
		</dd>
		<dt>Audio</dt>
		<dd>{srcAudio?.extendedDisplayTitle ?? srcAudio?.displayTitle ?? media?.audioCodec ?? '—'}</dd>
		<dt>Bitrate</dt>
		<dd>{mbps(media?.bitrate)}{#if srcVideo?.bitrate}&nbsp;(video {mbps(srcVideo.bitrate)}){/if}</dd>
		<dt>Subtitles</dt>
		<dd>
			{srcSub?.extendedDisplayTitle ?? srcSub?.displayTitle ?? 'Off'}
			{#if subtitleMode === 'client'}
				<span class="tag copy">browser</span>
			{:else if subtitleMode === 'burn'}
				<span class="tag burn">burned in</span>
			{/if}
		</dd>

		{#if mode === 'hls'}
			<dt class="section">Server decision</dt>
			{#if decision?.general}
				<dt>Result</dt>
				<dd>{decision.general}</dd>
			{/if}
			<dt>Video</dt>
			<dd>
				<span class="tag {decision?.video?.decision}">{decision?.video?.decision ?? '?'}</span>
				{streamLine(decision?.video)}
			</dd>
			<dt>Audio</dt>
			<dd>
				<span class="tag {decision?.audio?.decision}">{decision?.audio?.decision ?? '?'}</span>
				{streamLine(decision?.audio)}
			</dd>
			{#if decision?.subtitle}
				<dt>Subtitles</dt>
				<dd><span class="tag {decision.subtitle.decision}">{decision.subtitle.decision}</span></dd>
			{/if}

			{#if transcoder}
				<dt class="section">Transcoder</dt>
				<dt>Speed</dt>
				<dd class:warn={(transcoder.speed ?? 0) < 1 && !transcoderAhead}>
					{#if transcoderAhead && !transcoder.speed}
						Idle · {Math.round(transcoderAhead)} s ahead of playback
					{:else}
						{transcoder.speed?.toFixed(1) ?? '—'}×{#if transcoder.throttled}&nbsp;(throttled){/if}
					{/if}
				</dd>
				<dt>Hardware</dt>
				<dd>
					{#if transcoder.transcodeHwDecoding || transcoder.transcodeHwEncoding}
						decode {transcoder.transcodeHwDecoding ?? 'sw'} · encode {transcoder.transcodeHwEncoding ?? 'sw'}
					{:else}
						Software
					{/if}
				</dd>
				{#if transcoder.maxOffsetAvailable}
					<dt>Ready to</dt>
					<dd class="mono">{clock(transcoder.maxOffsetAvailable)}</dd>
				{/if}
			{:else if transcoderDenied}
				<dt class="section">Transcoder</dt>
				<dd class="full muted">Only the server owner can see transcoder stats.</dd>
			{/if}
		{/if}

		<dt class="section">Client</dt>
		<dt>Decoded</dt>
		<dd>{live.width ? `${live.width}×${live.height}` : '—'}</dd>
		{#if mode === 'hls'}
			<dt>Stream</dt>
			<dd>{mbps(live.levelBitrate / 1000)}{#if live.levelCodecs}&nbsp;· {live.levelCodecs}{/if}</dd>
			<dt>Bandwidth</dt>
			<dd>{mbps(live.bandwidth / 1000)}</dd>
		{/if}
		<dt>Buffer</dt>
		<dd>
			<span class="meter"><span style:width="{Math.min(100, (live.bufferAhead / 60) * 100)}%"></span></span>
			{live.bufferAhead.toFixed(1)} s
		</dd>
		<dt>Dropped</dt>
		<dd class:warn={droppedPct > 1}>{live.dropped} / {live.frames} ({droppedPct.toFixed(2)}%)</dd>
		<dt>Viewport</dt>
		<dd>{live.viewport}</dd>
	</dl>
</aside>

<style>
	.stats {
		position: absolute;
		top: max(76px, calc(env(safe-area-inset-top) + 64px));
		left: max(clamp(16px, 3vw, 40px), env(safe-area-inset-left));
		z-index: 6;
		width: min(380px, calc(100vw - 32px));
		max-height: calc(100% - 200px);
		overflow-y: auto;
		padding: 0.75rem 0.9rem 0.9rem;
		background: rgb(7 13 26 / 0.86);
		border: 1px solid var(--border);
		border-radius: 10px;
		backdrop-filter: blur(8px);
		box-shadow: var(--shadow);
		font-size: 0.78rem;
		line-height: 1.35;
		user-select: text;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}
	header strong {
		color: var(--accent);
		font-size: 0.85rem;
	}
	header button {
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		padding: 0.2rem;
		color: var(--text-dim);
		font-size: 1rem;
	}
	header button:hover {
		color: var(--accent);
	}
	dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.2rem 0.9rem;
		margin: 0;
	}
	dt {
		color: var(--text-dim);
		white-space: nowrap;
	}
	dt.section {
		grid-column: 1 / -1;
		margin-top: 0.6rem;
		padding-bottom: 0.2rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
		font-variant-numeric: tabular-nums;
	}
	dd.full {
		grid-column: 1 / -1;
	}
	.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
	}
	.accent {
		color: var(--accent);
	}
	.warn {
		color: #fbbf24;
	}
	.tag {
		display: inline-block;
		padding: 0 0.35rem;
		margin-right: 0.3rem;
		border-radius: 3px;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		background: var(--surface);
		color: var(--text-dim);
	}
	.tag.copy {
		background: rgb(125 211 252 / 0.15);
		color: var(--accent);
	}
	.tag.transcode,
	.tag.burn {
		background: rgb(251 191 36 / 0.15);
		color: #fbbf24;
	}
	.meter {
		display: inline-block;
		width: 70px;
		height: 5px;
		margin-right: 0.4rem;
		vertical-align: middle;
		border-radius: 3px;
		background: rgb(230 241 255 / 0.15);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.4s;
	}
	@media (max-width: 640px) {
		.stats {
			top: max(64px, calc(env(safe-area-inset-top) + 56px));
			left: 16px;
			max-height: 45vh;
			font-size: 0.72rem;
		}
	}
</style>
