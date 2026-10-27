<script lang="ts">
	import { subtitle } from '#lib/format.js';
	import { img } from '#lib/plex/images.js';
	import type { Metadata } from '#lib/plex/types.js';
	import Icon from './Icon.svelte';
	import PlayButton from './PlayButton.svelte';

	let { item }: { item: Metadata } = $props();

	const art = $derived(img(item.art ?? item.grandparentArt, 1920, 1080));
	let loaded = $state(false);
</script>

<section class="hero">
	{#if art}
		{#key art}
			<img class="art" class:loaded src={art} alt="" onload={() => (loaded = true)} />
		{/key}
	{/if}
	<div class="shade"></div>

	<div class="content">
		<h1>{item.title}</h1>
		<p class="meta">
			{subtitle(item)}
			{#if item.contentRating}<span class="rating">{item.contentRating}</span>{/if}
			{#if item.audienceRating}
				<span class="score"><Icon name="star" />{item.audienceRating.toFixed(1)}</span>
			{/if}
		</p>
		{#if item.summary}<p class="summary">{item.summary}</p>{/if}
		<div class="actions">
			<PlayButton {item} />
			<a class="btn btn-ghost" href="/title/{item.ratingKey}"><Icon name="info" /> More info</a>
		</div>
	</div>
</section>

<style>
	.hero {
		position: relative;
		height: min(85vh, 56.25vw + 120px);
		min-height: 440px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 20%;
		opacity: 0;
		transform: scale(1.04);
		transition:
			opacity 0.8s,
			transform 6s ease-out;
	}
	.art.loaded {
		opacity: 1;
		transform: scale(1);
	}
	.shade {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--bg) 2%, rgb(7 13 26 / 0.55) 30%, transparent 60%),
			linear-gradient(to right, rgb(7 13 26 / 0.9) 0%, rgb(7 13 26 / 0.45) 40%, transparent 70%),
			radial-gradient(ellipse at 20% 100%, rgb(56 189 248 / 0.18), transparent 60%);
	}
	.content {
		position: relative;
		padding: 0 var(--gutter) clamp(2rem, 7vw, 5rem);
		max-width: min(640px, 100%);
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(2rem, 5vw, 3.8rem);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 24px rgb(0 0 0 / 0.6);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin: 0 0 0.9rem;
		color: var(--text-dim);
		font-weight: 500;
	}
	.rating {
		border: 1px solid var(--text-dim);
		border-radius: 3px;
		padding: 0 0.35rem;
		font-size: 0.8rem;
	}
	.score {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--accent);
	}
	.summary {
		margin: 0 0 1.4rem;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-shadow: 0 1px 8px rgb(0 0 0 / 0.6);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	@media (max-width: 640px) {
		.summary {
			-webkit-line-clamp: 2;
			line-clamp: 2;
			font-size: 0.92rem;
		}
	}
</style>
