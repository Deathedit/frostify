<script lang="ts">
	import { duration, progress } from '#lib/format.js';
	import { img } from '#lib/plex/images.js';
	import type { Metadata } from '#lib/plex/types.js';
	import Icon from './Icon.svelte';

	let { episodes }: { episodes: Metadata[] } = $props();
</script>

<ol class="episodes">
	{#each episodes as ep (ep.ratingKey)}
		{@const pct = progress(ep)}
		<li>
			<a href="/watch/{ep.ratingKey}" class="ep">
				<span class="num">{ep.index ?? ''}</span>
				<div class="thumb">
					{#if ep.thumb}<img src={img(ep.thumb, 260, 146)} alt="" loading="lazy" />{/if}
					<span class="play"><Icon name="play" /></span>
					{#if pct > 0}
						<div class="progress-track bar"><div class="progress-fill" style:width="{pct * 100}%"></div></div>
					{/if}
				</div>
				<div class="info">
					<div class="head">
						<strong>{ep.title}</strong>
						<span class="muted">
							{#if ep.viewCount && !pct}<Icon name="check" class="watched" />{/if}
							{duration(ep.duration)}
						</span>
					</div>
					{#if ep.summary}<p class="muted">{ep.summary}</p>{/if}
				</div>
			</a>
		</li>
	{/each}
</ol>

<style>
	.episodes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	.ep {
		display: grid;
		grid-template-columns: 2.5rem 200px minmax(0, 1fr);
		align-items: center;
		gap: 1.25rem;
		padding: 1.1rem 1rem;
		border-radius: var(--radius);
		transition: background 0.15s;
	}
	.ep:hover {
		background: var(--bg-elev);
	}
	.num {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-dim);
		text-align: center;
	}
	.thumb {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 6px;
		overflow: hidden;
		background: var(--surface);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 1.8rem;
		background: rgb(7 13 26 / 0.45);
		color: var(--accent);
		opacity: 0;
		transition: opacity 0.2s;
	}
	.ep:hover .play {
		opacity: 1;
	}
	.bar {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 6px;
	}
	.info {
		min-width: 0;
	}
	.head strong {
		overflow-wrap: anywhere;
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: baseline;
	}
	.head span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
		font-size: 0.9rem;
	}
	.head :global(.watched) {
		color: var(--accent);
	}
	p {
		margin: 0.4rem 0 0;
		font-size: 0.9rem;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	@media (max-width: 640px) {
		.ep {
			grid-template-columns: 120px minmax(0, 1fr);
			align-items: start;
			gap: 0.8rem;
			padding: 0.8rem 0;
		}
		.num {
			display: none;
		}
		.head {
			flex-direction: column;
			gap: 0.15rem;
		}
		.head strong {
			font-size: 0.92rem;
		}
		.head span {
			font-size: 0.8rem;
		}
		p {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}
</style>
