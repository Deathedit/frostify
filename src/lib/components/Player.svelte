<script lang="ts">
	import Hls from 'hls.js';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { clock, episodeCode } from '#lib/format.js';
	import { getAllLeaves, getMetadata } from '#lib/plex/library.js';
	import { isTextSubtitle, loadSubtitleVtt } from '#lib/plex/subtitles.js';
	import {
		QUALITIES,
		type Quality,
		type TranscodeDecision,
		canDirectPlay,
		directPlayUrl,
		reportTimeline,
		selectStream,
		startTranscode,
		stopTranscode,
		streams
	} from '#lib/plex/playback.js';
	import type { Metadata } from '#lib/plex/types.js';
	import { session } from '#lib/stores/session.svelte.js';
	import Icon from './Icon.svelte';
	import PlayerStats from './PlayerStats.svelte';
	import Spinner from './Spinner.svelte';

	let { ratingKey, onexit }: { ratingKey: string; onexit: () => void } = $props();

	let container: HTMLDivElement;
	let video: HTMLVideoElement;
	let hls: Hls | null = null;
	let sessionId = $state(crypto.randomUUID());
	let destroyed = false;
	let forceTranscode = false;
	let networkRetries = 0;

	let meta = $state<Metadata | null>(null);
	let mode = $state<'direct' | 'hls'>('direct');
	let quality = $state<Quality>(QUALITIES[0]);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let buffering = $state(false);
	let resumeAt = $state<number | null>(null);
	let nextEp = $state<Metadata | null>(null);

	let time = $state(0);
	let videoDuration = $state(0);
	let bufferedEnd = $state(0);
	let paused = $state(true);
	let volume = $state(1);
	let muted = $state(false);
	let scrubbing = $state<number | null>(null);

	let controlsVisible = $state(true);
	let settingsOpen = $state(false);
	let statsOpen = $state(false);
	let decision = $state<TranscodeDecision | null>(null);
	let subtitleMode = $state<'off' | 'client' | 'burn'>('off');
	let subtitleUrl = $state<string | null>(null);
	let trackEl = $state<HTMLTrackElement>();
	let cuesLoaded = $state(0);
	let fullscreen = $state(false);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let lastPointer = 'mouse';

	const duration = $derived(
		Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : (meta?.duration ?? 0) / 1000
	);
	const shownTime = $derived(scrubbing ?? time);
	const showUi = $derived(controlsVisible || paused || settingsOpen || !!error);

	// Lift subtitles above the control bar while it's showing, drop them back when it hides.
	$effect(() => {
		void cuesLoaded;
		const cues = trackEl?.track.cues;
		if (!cues) return;
		const line = showUi ? -5 : 'auto';
		for (const cue of cues) (cue as VTTCue).line = line;
	});
	const showNext = $derived(!!nextEp && duration > 0 && duration - time < 30 && !error);
	const audioStreams = $derived(meta ? streams(meta, 2) : []);
	const subtitleStreams = $derived(meta ? streams(meta, 3) : []);

	onMount(() => {
		try {
			volume = Number(localStorage.getItem('frostify.volume') ?? 1);
		} catch {
			// keep default
		}
		init();
		poke();

		const onFs = () => (fullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onFs);
		const beat = setInterval(() => {
			if (meta && !paused) report('playing');
		}, 10_000);

		return () => {
			destroyed = true;
			clearInterval(beat);
			clearTimeout(hideTimer);
			document.removeEventListener('fullscreenchange', onFs);
			report('stopped');
			teardown();
		};
	});

	$effect(() => {
		if (video) {
			video.volume = Math.min(1, Math.max(0, volume));
			video.muted = muted;
		}
		try {
			localStorage.setItem('frostify.volume', String(volume));
		} catch {
			// ignore
		}
	});

	async function init() {
		try {
			meta = await getMetadata(ratingKey);
		} catch (e) {
			fail(e);
			return;
		}
		const offset = (meta.viewOffset ?? 0) / 1000;
		const nearEnd = meta.duration && (meta.viewOffset ?? 0) > meta.duration * 0.95;
		if (offset > 30 && !nearEnd) {
			resumeAt = offset;
			loading = false;
		} else {
			start(0);
		}
		if (meta.type === 'episode' && meta.grandparentRatingKey) {
			getAllLeaves(meta.grandparentRatingKey)
				.then((leaves) => {
					const i = leaves.findIndex((l) => l.ratingKey === ratingKey);
					nextEp = i >= 0 ? (leaves[i + 1] ?? null) : null;
				})
				.catch(() => {});
		}
	}

	function fail(e: unknown) {
		error = e instanceof Error ? e.message : String(e);
		loading = false;
		buffering = false;
	}

	function teardown() {
		hls?.destroy();
		hls = null;
		if (mode === 'hls') stopTranscode(sessionId);
		if (video) {
			video.removeAttribute('src');
			video.load();
		}
	}

	function seekOnLoad(at: number) {
		if (at > 0) video.addEventListener('loadedmetadata', () => (video.currentTime = at), { once: true });
	}

	async function start(at: number) {
		const m = meta;
		if (!m) return;
		resumeAt = null;
		error = null;
		loading = true;
		networkRetries = 0;
		teardown();
		try {
			const sub = streams(m, 3).find((s) => s.selected);
			subtitleUrl = null;
			subtitleMode = sub ? 'burn' : 'off';
			if (sub && isTextSubtitle(sub)) {
				try {
					subtitleUrl = await loadSubtitleVtt(sub);
					subtitleMode = 'client';
				} catch {
					// couldn't fetch/convert it: let the server burn it in instead
				}
				if (destroyed) return;
			}
			const burn = subtitleMode === 'burn';

			if (!forceTranscode && canDirectPlay(m, quality, video, burn)) {
				mode = 'direct';
				decision = null;
				video.src = directPlayUrl(m);
				seekOnLoad(at);
			} else {
				mode = 'hls';
				sessionId = crypto.randomUUID();
				const res = await startTranscode(m, quality, sessionId, burn);
				if (destroyed) return;
				const url = res.url;
				decision = res.decision;
				if (Hls.isSupported()) {
					const token = session.server?.token ?? '';
					hls = new Hls({
						startPosition: at,
						maxBufferLength: 60,
						xhrSetup: (xhr) => xhr.setRequestHeader('X-Plex-Token', token)
					});
					hls.on(Hls.Events.ERROR, (_, data) => {
						if (!data.fatal || !hls) return;
						if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 3) hls.startLoad();
						else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
						else fail(new Error(`Stream error: ${data.details}`));
					});
					hls.loadSource(url);
					hls.attachMedia(video);
				} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
					video.src = url;
					seekOnLoad(at);
				} else {
					throw new Error('This browser cannot play HLS streams.');
				}
			}
			await video.play().catch(() => {
				// autoplay blocked; the big play button takes over
			});
		} catch (e) {
			fail(e);
		}
	}

	function onVideoError() {
		if (!video.getAttribute('src') && !hls) return;
		// Direct play can fail on codecs canPlayType was optimistic about: fall back to a transcode.
		if (mode === 'direct' && !forceTranscode) {
			forceTranscode = true;
			start(time);
		} else if (mode === 'direct') {
			fail(new Error('The browser could not decode this file.'));
		}
	}

	function report(state: 'playing' | 'paused' | 'stopped') {
		if (meta) reportTimeline(meta, state, time * 1000, sessionId);
	}

	function updateBuffered() {
		const b = video.buffered;
		for (let i = 0; i < b.length; i++) {
			if (b.start(i) <= video.currentTime + 0.5 && b.end(i) >= video.currentTime) {
				bufferedEnd = b.end(i);
				return;
			}
		}
		bufferedEnd = video.currentTime;
	}

	function togglePlay() {
		if (video.paused) video.play().catch(() => {});
		else video.pause();
	}

	function skip(seconds: number) {
		video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), duration || Infinity);
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else container.requestFullscreen?.().catch(() => {});
	}

	function poke() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (controlsVisible = false), 3000);
	}

	// Mouse: click toggles playback. Touch: tap toggles the controls, like native mobile players.
	function onVideoClick() {
		if (lastPointer === 'mouse') togglePlay();
		else if (controlsVisible && !paused) {
			clearTimeout(hideTimer);
			controlsVisible = false;
		} else poke();
	}

	function playNext() {
		if (nextEp) goto(`/watch/${nextEp.ratingKey}`, { replace: true });
	}

	function onEnded() {
		report('stopped');
		if (nextEp) playNext();
		else onexit();
	}

	function setQuality(q: Quality) {
		quality = q;
		settingsOpen = false;
		start(time);
	}

	async function setStream(kind: 'audio' | 'subtitle', id: number) {
		const part = meta?.Media?.[0]?.Part?.[0];
		if (!part) return;
		settingsOpen = false;
		const at = time;
		try {
			await selectStream(part.id, kind, id);
			meta = await getMetadata(ratingKey);
			start(at);
		} catch (e) {
			fail(e);
		}
	}

	function onkey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
		if (e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return;
		const handled = (() => {
			switch (e.key) {
				case ' ':
				case 'k':
					togglePlay();
					return true;
				case 'ArrowLeft':
				case 'j':
					skip(-10);
					return true;
				case 'ArrowRight':
				case 'l':
					skip(10);
					return true;
				case 'ArrowUp':
					volume = Math.min(1, volume + 0.1);
					return true;
				case 'ArrowDown':
					volume = Math.max(0, volume - 0.1);
					return true;
				case 'f':
					toggleFullscreen();
					return true;
				case 'i':
					statsOpen = !statsOpen;
					return true;
				case 'm':
					muted = !muted;
					return true;
				case 'Escape':
					if (settingsOpen) settingsOpen = false;
					else if (!document.fullscreenElement) onexit();
					return true;
			}
			return false;
		})();
		if (handled) {
			e.preventDefault();
			poke();
		}
	}
</script>

<svelte:window onkeydown={onkey} />

<div
	class="player"
	class:hide-cursor={!showUi}
	bind:this={container}
	onpointermove={(e) => {
		if (e.pointerType === 'mouse') poke();
	}}
	onpointerdown={(e) => {
		lastPointer = e.pointerType;
		if (e.target !== video) poke();
	}}
	role="application"
	aria-label="Video player"
>
	<!-- svelte-ignore a11y_media_has_caption (captions are added below only when a subtitle is selected) -->
	<video
		bind:this={video}
		playsinline
		onclick={onVideoClick}
		ondblclick={toggleFullscreen}
		ontimeupdate={() => {
			time = video.currentTime;
			updateBuffered();
		}}
		ondurationchange={() => (videoDuration = video.duration)}
		onprogress={updateBuffered}
		onplay={() => {
			paused = false;
			report('playing');
			poke();
		}}
		onpause={() => {
			paused = true;
			report('paused');
		}}
		onwaiting={() => (buffering = true)}
		onplaying={() => {
			buffering = false;
			loading = false;
		}}
		oncanplay={() => (loading = false)}
		onended={onEnded}
		onerror={onVideoError}
		onvolumechange={() => {
			volume = video.volume;
			muted = video.muted;
		}}
	>
		{#if subtitleUrl}
			{@const sub = subtitleStreams.find((s) => s.selected)}
			<track
				bind:this={trackEl}
				kind="subtitles"
				src={subtitleUrl}
				srclang={sub?.languageCode}
				label={sub?.displayTitle ?? 'Subtitles'}
				default
				onload={(e) => {
					(e.currentTarget as HTMLTrackElement).track.mode = 'showing';
					cuesLoaded++;
				}}
			/>
		{/if}
	</video>

	{#if (loading || buffering) && !error && resumeAt === null}
		<div class="center"><Spinner size={64} /></div>
	{:else if paused && !error && resumeAt === null}
		<button class="center big-play" aria-label="Play" onclick={togglePlay}><Icon name="play" /></button>
	{/if}

	{#if resumeAt !== null}
		<div class="center dialog">
			<h2>Pick up where you left off?</h2>
			<div class="dialog-actions">
				<button class="btn btn-primary" onclick={() => start(resumeAt ?? 0)}>
					<Icon name="play" /> Resume from {clock(resumeAt)}
				</button>
				<button class="btn btn-ghost" onclick={() => start(0)}>Start from beginning</button>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="center dialog">
			<h2>Playback failed</h2>
			<p class="muted">{error}</p>
			<div class="dialog-actions">
				<button
					class="btn btn-primary"
					onclick={() => {
						forceTranscode = true;
						start(time);
					}}>Try again</button
				>
				<button class="btn btn-ghost" onclick={onexit}>Go back</button>
			</div>
		</div>
	{/if}

	{#if statsOpen && meta}
		<PlayerStats
			{meta}
			{mode}
			{quality}
			{decision}
			{subtitleMode}
			{sessionId}
			getVideo={() => video}
			getHls={() => hls}
			onclose={() => (statsOpen = false)}
		/>
	{/if}

	{#if showNext && nextEp}
		<button class="next-up" onclick={playNext}>
			<span class="muted">Next episode</span>
			<strong>{episodeCode(nextEp)} — {nextEp.title}</strong>
			<span class="next-cta"><Icon name="next" /> Play now</span>
		</button>
	{/if}

	<div class="chrome" class:visible={showUi}>
		<div class="top">
			<button class="ctl" aria-label="Back" onclick={onexit}><Icon name="back" /></button>
			{#if meta}
				<div class="title">
					{#if meta.type === 'episode'}
						<strong>{meta.grandparentTitle}</strong>
						<span>{episodeCode(meta)} — {meta.title}</span>
					{:else}
						<strong>{meta.title}</strong>
						{#if meta.year}<span>{meta.year}</span>{/if}
					{/if}
				</div>
			{/if}
		</div>

		<div class="bottom">
			<div class="seek">
				<span class="time">{clock(shownTime)}</span>
				<input
					type="range"
					min="0"
					max={duration || 1}
					step="0.1"
					value={shownTime}
					style:--pct="{duration ? (shownTime / duration) * 100 : 0}%"
					style:--buf="{duration ? (bufferedEnd / duration) * 100 : 0}%"
					aria-label="Seek"
					oninput={(e) => (scrubbing = e.currentTarget.valueAsNumber)}
					onchange={(e) => {
						video.currentTime = e.currentTarget.valueAsNumber;
						scrubbing = null;
					}}
				/>
				<span class="time">-{clock(duration - shownTime)}</span>
			</div>

			<div class="buttons">
				<button class="ctl" aria-label={paused ? 'Play' : 'Pause'} onclick={togglePlay}>
					<Icon name={paused ? 'play' : 'pause'} />
				</button>
				<button class="ctl" aria-label="Back 10 seconds" onclick={() => skip(-10)}><Icon name="rewind" /></button>
				<button class="ctl" aria-label="Forward 10 seconds" onclick={() => skip(10)}><Icon name="forward" /></button>
				<div class="volume">
					<button class="ctl" aria-label={muted ? 'Unmute' : 'Mute'} onclick={() => (muted = !muted)}>
						<Icon name={muted || volume === 0 ? 'mute' : 'volume'} />
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={volume}
						style:--pct="{(muted ? 0 : volume) * 100}%"
						aria-label="Volume"
					/>
				</div>

				<span class="spacer"></span>
				<span class="mode muted">{mode === 'direct' ? 'Direct play' : `Streaming · ${quality.label}`}</span>

				{#if nextEp}
					<button class="ctl" aria-label="Next episode" onclick={playNext}><Icon name="next" /></button>
				{/if}
				<div class="settings-wrap">
					<button
						class="ctl"
						aria-label="Settings"
						aria-expanded={settingsOpen}
						onclick={() => (settingsOpen = !settingsOpen)}
					>
						<Icon name="settings" />
					</button>
					{#if settingsOpen}
						<div class="settings">
							<section>
								<h3>Quality</h3>
								{#each QUALITIES as q (q.id)}
									<button class:sel={q.id === quality.id} onclick={() => setQuality(q)}>
										<Icon name="check" />{q.label}
									</button>
								{/each}
							</section>
							{#if audioStreams.length > 1}
								<section>
									<h3>Audio</h3>
									{#each audioStreams as s (s.id)}
										<button class:sel={s.selected} onclick={() => setStream('audio', s.id)}>
											<Icon name="check" />{s.extendedDisplayTitle ?? s.displayTitle}
										</button>
									{/each}
								</section>
							{/if}
							{#if subtitleStreams.length}
								<section>
									<h3>Subtitles</h3>
									<button
										class:sel={!subtitleStreams.some((s) => s.selected)}
										onclick={() => setStream('subtitle', 0)}
									>
										<Icon name="check" />Off
									</button>
									{#each subtitleStreams as s (s.id)}
										<button class:sel={s.selected} onclick={() => setStream('subtitle', s.id)}>
											<Icon name="check" />{s.extendedDisplayTitle ?? s.displayTitle}
										</button>
									{/each}
								</section>
							{/if}
							<section>
								<h3>Advanced</h3>
								<button
									class:sel={statsOpen}
									onclick={() => {
										statsOpen = !statsOpen;
										settingsOpen = false;
									}}
								>
									<Icon name="check" />Playback stats <kbd>I</kbd>
								</button>
							</section>
						</div>
					{/if}
				</div>
				<button class="ctl" aria-label="Fullscreen" onclick={toggleFullscreen}>
					<Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} />
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.player {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: #000;
		color: var(--text);
		user-select: none;
	}
	.hide-cursor {
		cursor: none;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}
	video::cue {
		font-family: Inter, system-ui, sans-serif;
		font-size: clamp(1rem, 2.6vw, 2rem);
		line-height: 1.3;
		color: #fff;
		background: rgb(3 7 15 / 0.55);
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.9);
	}
	.center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 3;
	}
	.big-play {
		display: grid;
		place-items: center;
		width: 88px;
		height: 88px;
		border-radius: 50%;
		border: 0;
		font-size: 2.4rem;
		background: rgb(125 211 252 / 0.9);
		color: var(--accent-ink);
		box-shadow: var(--glow);
		padding-left: 6px;
	}
	.dialog {
		width: min(520px, calc(100% - 32px));
		text-align: center;
		background: rgb(14 26 46 / 0.92);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1.75rem;
		box-shadow: var(--shadow);
		backdrop-filter: blur(10px);
	}
	.dialog h2 {
		margin: 0 0 1rem;
		font-size: 1.25rem;
	}
	.dialog p {
		margin: -0.25rem 0 1.25rem;
		overflow-wrap: anywhere;
	}
	.dialog-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.chrome {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.3s;
		z-index: 4;
	}
	.chrome.visible {
		opacity: 1;
	}
	.chrome.visible > * {
		pointer-events: auto;
	}
	.top,
	.bottom {
		padding: 1rem max(clamp(16px, 3vw, 40px), env(safe-area-inset-right))
			max(1rem, env(safe-area-inset-bottom)) max(clamp(16px, 3vw, 40px), env(safe-area-inset-left));
	}
	.top {
		padding-top: max(1rem, env(safe-area-inset-top));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: linear-gradient(to bottom, rgb(0 0 0 / 0.75), transparent);
	}
	.title {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.title strong {
		font-size: 1.15rem;
	}
	.title span {
		color: var(--text-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bottom {
		background: linear-gradient(to top, rgb(0 0 0 / 0.85), transparent);
		padding-top: 3rem;
	}
	.seek {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}
	.time {
		font-variant-numeric: tabular-nums;
		font-size: 0.85rem;
		min-width: 3.5rem;
		text-align: center;
	}
	.buttons {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}
	.spacer {
		flex: 1;
	}
	.mode {
		font-size: 0.8rem;
		margin-right: 0.5rem;
	}
	.ctl {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: none;
		font-size: 1.6rem;
		transition:
			color 0.15s,
			transform 0.15s;
	}
	.ctl:hover {
		color: var(--accent);
		transform: scale(1.12);
	}

	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		flex: 1;
		height: 18px;
		background: transparent;
		cursor: pointer;
		--track: linear-gradient(
			to right,
			var(--accent) var(--pct),
			rgb(230 241 255 / 0.45) var(--pct) var(--buf, var(--pct)),
			rgb(230 241 255 / 0.18) var(--buf, var(--pct))
		);
	}
	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
		background: var(--track);
		transition: height 0.15s;
	}
	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: var(--track);
	}
	input[type='range']:hover::-webkit-slider-runnable-track {
		height: 6px;
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		margin-top: -5px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
		border: 0;
	}
	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
		border: 0;
	}
	.volume {
		display: flex;
		align-items: center;
	}
	.volume input {
		width: 0;
		flex: none;
		opacity: 0;
		transition:
			width 0.2s,
			opacity 0.2s;
	}
	.volume:hover input,
	.volume:focus-within input {
		width: 90px;
		opacity: 1;
	}

	.settings-wrap {
		position: relative;
	}
	.settings {
		position: absolute;
		right: 0;
		bottom: calc(100% + 10px);
		width: min(280px, calc(100vw - 32px));
		max-height: min(60vh, 420px);
		overflow-y: auto;
		background: rgb(14 26 46 / 0.96);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.5rem;
		box-shadow: var(--shadow);
	}
	.settings section + section {
		border-top: 1px solid var(--border);
		margin-top: 0.4rem;
		padding-top: 0.4rem;
	}
	.settings h3 {
		margin: 0.4rem 0.6rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}
	.settings button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border: 0;
		background: none;
		padding: 0.5rem 0.6rem;
		border-radius: 6px;
		text-align: left;
		font-size: 0.9rem;
	}
	.settings button :global(.icon) {
		visibility: hidden;
		color: var(--accent);
	}
	.settings button.sel {
		color: var(--accent);
	}
	.settings button.sel :global(.icon) {
		visibility: visible;
	}
	.settings button:hover {
		background: var(--surface);
	}
	.settings kbd {
		margin-left: auto;
		font: inherit;
		font-size: 0.7rem;
		padding: 0 0.35rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text-dim);
	}

	.next-up {
		position: absolute;
		right: clamp(16px, 3vw, 40px);
		bottom: 140px;
		z-index: 5;
		display: grid;
		gap: 0.3rem;
		text-align: left;
		max-width: 320px;
		padding: 1rem 1.2rem;
		border-radius: 10px;
		border: 1px solid var(--accent);
		background: rgb(7 13 26 / 0.9);
		box-shadow: var(--glow);
	}
	.next-up .muted {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.next-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--accent);
		font-weight: 700;
		margin-top: 0.3rem;
	}

	@media (max-width: 640px) {
		.mode,
		.volume {
			display: none;
		}
		.title strong {
			font-size: 1rem;
		}
		.title span {
			font-size: 0.85rem;
		}
		.big-play {
			width: 68px;
			height: 68px;
			font-size: 1.9rem;
		}
		.bottom {
			padding-top: 2rem;
		}
		.seek {
			gap: 0.5rem;
		}
		.buttons {
			gap: 0.1rem;
			margin-top: 0.25rem;
		}
		.dialog {
			padding: 1.25rem;
		}
		.dialog-actions :global(.btn) {
			flex: 1 1 100%;
		}
		.ctl {
			width: 38px;
			height: 38px;
			font-size: 1.35rem;
		}
		.time {
			min-width: 2.8rem;
			font-size: 0.75rem;
		}
		.next-up {
			left: 16px;
			right: 16px;
			bottom: calc(110px + env(safe-area-inset-bottom));
			max-width: none;
		}
	}
	/* Phones held sideways: very little height, so tighten the chrome. */
	@media (max-height: 480px) {
		.bottom {
			padding-top: 1.25rem;
		}
		.next-up {
			bottom: 96px;
		}
		.settings {
			max-height: 70vh;
		}
	}
</style>
