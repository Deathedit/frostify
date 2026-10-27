<script lang="ts">
	import { clock, displayTitle, episodeCode } from '#lib/format.js';
	import { type PlaybackSession, getSessions, terminateSession } from '#lib/plex/admin.js';
	import { img } from '#lib/plex/images.js';
	import { poll } from '#lib/poll.js';
	import Icon from '../Icon.svelte';
	import Spinner from '../Spinner.svelte';

	let sessions = $state<PlaybackSession[] | null>(null);
	let error = $state('');
	let stopping = $state<string | null>(null);

	$effect(() =>
		poll(async () => {
			try {
				sessions = await getSessions();
				error = '';
			} catch (e) {
				error = e instanceof Error ? e.message : 'Could not load sessions';
			}
		}, 3000)
	);

	const totalKbps = $derived((sessions ?? []).reduce((sum, s) => sum + (s.Session?.bandwidth ?? 0), 0));
	const transcodes = $derived((sessions ?? []).filter((s) => s.TranscodeSession?.videoDecision === 'transcode').length);

	function quality(s: PlaybackSession): string {
		const t = s.TranscodeSession;
		if (!t) return 'Direct play';
		const v = t.videoDecision === 'copy' ? 'Direct stream' : t.videoDecision === 'transcode' ? 'Transcode' : '';
		const parts = [
			`video ${t.videoDecision ?? '?'}`,
			`audio ${t.audioDecision ?? '?'}`,
			t.subtitleDecision ? `subs ${t.subtitleDecision}` : ''
		].filter(Boolean);
		const hw = t.transcodeHwEncoding || t.transcodeHwDecoding ? ' · HW' : '';
		const speed = t.speed != null ? ` · ${t.throttled ? 'throttled' : `${t.speed.toFixed(1)}×`}` : '';
		return `${v || 'Stream'} (${parts.join(', ')})${hw}${speed}`;
	}

	function mbps(kbps: number | undefined) {
		return kbps ? `${(kbps / 1000).toFixed(1)} Mbps` : '—';
	}

	async function stop(s: PlaybackSession) {
		const id = s.Session?.id;
		if (!id) return;
		const who = s.User?.title ?? 'this viewer';
		const reason = prompt(`Stop ${who}'s stream? Message shown to them:`, 'The server owner ended this stream.');
		if (reason === null) return;
		stopping = id;
		try {
			await terminateSession(id, reason);
			sessions = await getSessions();
		} catch (e) {
			alert(e instanceof Error ? `Could not stop stream: ${e.message}` : 'Could not stop stream');
		} finally {
			stopping = null;
		}
	}
</script>

{#if error}<p class="error">{error}</p>{/if}

{#if !sessions}
	<div class="center"><Spinner /></div>
{:else}
	<div class="summary">
		<div class="tile"><span class="num">{sessions.length}</span><span class="muted">active streams</span></div>
		<div class="tile"><span class="num">{transcodes}</span><span class="muted">video transcodes</span></div>
		<div class="tile"><span class="num">{mbps(totalKbps)}</span><span class="muted">total bandwidth</span></div>
	</div>

	{#if sessions.length === 0}
		<p class="empty muted">Nobody is watching right now.</p>
	{/if}

	<div class="grid">
		{#each sessions as s (s.Session?.id ?? s.sessionKey ?? s.ratingKey)}
			{@const pct = s.duration ? ((s.viewOffset ?? 0) / s.duration) * 100 : 0}
			{@const state = s.Player?.state ?? 'playing'}
			<article class="card">
				<div class="art">
					{#if s.art || s.grandparentArt || s.thumb}
						<img src={img(s.type === 'episode' ? s.thumb : (s.art ?? s.thumb), 480, 270)} alt="" />
					{/if}
					<span class="state {state}">
						{#if state === 'buffering'}<Spinner size={12} />{:else}<Icon name={state === 'paused' ? 'pause' : 'play'} />{/if}
						{state[0].toUpperCase() + state.slice(1)}
					</span>
				</div>
				<div class="body">
					<a href="/title/{s.ratingKey}" class="title">{displayTitle(s)}</a>
					{#if s.type === 'episode'}<div class="muted small">{episodeCode(s)} — {s.title}</div>{/if}

					<div class="progress">
						<div class="progress-track"><div class="progress-fill" style:width="{pct}%"></div></div>
						<span class="small muted">{clock((s.viewOffset ?? 0) / 1000)} / {clock((s.duration ?? 0) / 1000)}</span>
					</div>

					<dl>
						<dt>User</dt>
						<dd class="user">
							{#if s.User?.thumb}<img src={s.User.thumb} alt="" />{/if}
							{s.User?.title ?? 'Unknown'}
						</dd>
						<dt>Player</dt>
						<dd>{[s.Player?.product, s.Player?.platform, s.Player?.title].filter(Boolean).join(' · ')}</dd>
						<dt>Network</dt>
						<dd>
							{s.Session?.location === 'lan' ? 'LAN' : 'Remote'}{s.Player?.relayed ? ' (relay)' : ''}
							· {mbps(s.Session?.bandwidth)}{#if s.Player?.address}&nbsp;· {s.Player.address}{/if}
						</dd>
						<dt>Quality</dt>
						<dd class:transcoding={s.TranscodeSession?.videoDecision === 'transcode'}>{quality(s)}</dd>
					</dl>

					<button class="btn btn-ghost stop" disabled={stopping === s.Session?.id || !s.Session?.id} onclick={() => stop(s)}>
						<Icon name="close" /> Stop stream
					</button>
				</div>
			</article>
		{/each}
	</div>
{/if}

<style>
	.center {
		display: grid;
		place-items: center;
		min-height: 200px;
	}
	.error {
		color: var(--danger);
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.tile {
		display: grid;
		gap: 0.2rem;
		padding: 1rem 1.2rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.num {
		font-size: 1.8rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.empty {
		padding: 2rem 0;
		text-align: center;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 1rem;
	}
	.card {
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		min-width: 0;
	}
	.art {
		position: relative;
		aspect-ratio: 16 / 7;
		background: var(--surface);
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.state {
		position: absolute;
		top: 10px;
		left: 10px;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: rgb(7 13 26 / 0.85);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.state.playing {
		color: var(--status-good);
	}
	.state.paused {
		color: var(--text-dim);
	}
	.state.buffering {
		color: var(--status-warning);
	}
	.body {
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
	}
	.title {
		font-weight: 700;
		font-size: 1.05rem;
	}
	.title:hover {
		color: var(--accent);
	}
	.small {
		font-size: 0.82rem;
	}
	.progress {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.progress .progress-track {
		flex: 1;
	}
	dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.3rem 0.9rem;
		margin: 0;
		font-size: 0.85rem;
	}
	dt {
		color: var(--text-dim);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.user {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.user img {
		width: 20px;
		height: 20px;
		border-radius: 50%;
	}
	.transcoding {
		color: var(--status-warning);
	}
	.stop {
		justify-self: start;
		padding: 0.5rem 0.9rem;
		font-size: 0.85rem;
	}
	.stop:hover:not(:disabled) {
		color: var(--danger);
	}
</style>
