<script lang="ts">
	import { displayTitle, progress, subtitle, unwatchedCount } from '#lib/format.js';
	import { img } from '#lib/plex/images.js';
	import type { Metadata } from '#lib/plex/types.js';
	import Icon from './Icon.svelte';

	let {
		item,
		variant = 'poster'
	}: { item: Metadata; variant?: 'poster' | 'landscape' } = $props();

	const landscape = $derived(variant === 'landscape');
	const src = $derived(
		landscape
			? img(item.type === 'episode' ? item.thumb : (item.art ?? item.thumb), 400, 225)
			: img(item.type === 'episode' ? (item.grandparentThumb ?? item.thumb) : item.thumb, 240, 360)
	);
	const pct = $derived(progress(item));
	const unwatched = $derived(unwatchedCount(item));
	const playable = $derived(item.type === 'movie' || item.type === 'episode');
	const href = $derived(
		landscape && playable && pct > 0 ? `/watch/${item.ratingKey}` : `/title/${item.ratingKey}`
	);
	let loaded = $state(false);
</script>

<a {href} class="card" class:landscape title={displayTitle(item)}>
	<div class="frame" class:loaded>
		{#if src}
			<img {src} alt="" loading="lazy" decoding="async" onload={() => (loaded = true)} />
		{/if}
		<span class="fallback">{displayTitle(item)}</span>

		{#if item.type === 'show' && unwatched > 0}
			<span class="badge">{unwatched}</span>
		{:else if playable && item.viewCount && !pct}
			<span class="badge watched" aria-label="Watched"><Icon name="check" /></span>
		{/if}

		<div class="hover">
			{#if playable}
				<span class="play"><Icon name="play" /></span>
			{/if}
			<div class="meta">
				<strong>{displayTitle(item)}</strong>
				<span>{subtitle(item)}</span>
			</div>
		</div>

		{#if pct > 0}
			<div class="progress-track bar"><div class="progress-fill" style:width="{pct * 100}%"></div></div>
		{/if}
	</div>
	{#if landscape}
		<div class="caption">
			<strong>{displayTitle(item)}</strong>
			<span class="muted">{subtitle(item)}</span>
		</div>
	{/if}
</a>

<style>
	.card {
		display: block;
		width: var(--card-w, 170px);
		flex: none;
		scroll-snap-align: start;
	}
	.card.landscape {
		width: var(--card-w-wide, 300px);
	}
	.frame {
		position: relative;
		aspect-ratio: 2 / 3;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--bg-elev);
		transition:
			transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.25s;
	}
	.landscape .frame {
		aspect-ratio: 16 / 9;
	}
	.card:hover .frame,
	.card:focus-visible .frame {
		transform: scale(1.08);
		box-shadow:
			0 0 0 2px var(--accent),
			var(--glow),
			var(--shadow);
		z-index: 2;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.3s;
	}
	.loaded img {
		opacity: 1;
	}
	.fallback {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 0.75rem;
		text-align: center;
		font-weight: 600;
		color: var(--text-dim);
		z-index: -0;
	}
	.loaded .fallback {
		display: none;
	}
	.badge {
		position: absolute;
		top: 6px;
		right: 6px;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.75rem;
		font-weight: 800;
	}
	.badge.watched {
		background: rgb(7 13 26 / 0.75);
		color: var(--accent);
	}
	.hover {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem;
		background: linear-gradient(to top, rgb(7 13 26 / 0.95) 10%, rgb(7 13 26 / 0.2) 60%, transparent);
		opacity: 0;
		transition: opacity 0.2s;
	}
	.card:hover .hover,
	.card:focus-visible .hover {
		opacity: 1;
	}
	.play {
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
		box-shadow: var(--glow);
	}
	.meta {
		display: grid;
		gap: 0.15rem;
		font-size: 0.8rem;
		line-height: 1.25;
	}
	.meta strong {
		font-size: 0.88rem;
	}
	.meta span {
		color: var(--text-dim);
	}
	.landscape .meta {
		display: none;
	}
	.bar {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 8px;
	}
	.caption {
		display: grid;
		gap: 0.15rem;
		padding: 0.6rem 0.15rem 0;
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.caption strong,
	.caption span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.card {
			width: var(--card-w, 120px);
		}
		.card.landscape {
			width: var(--card-w-wide, 240px);
		}
	}
</style>
