<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import PosterCard from '#lib/components/PosterCard.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { search } from '#lib/plex/library.js';
	import type { Metadata } from '#lib/plex/types.js';

	let query = $state(page.url.searchParams.get('q') ?? '');
	let results = $state<Metadata[]>([]);
	let loading = $state(false);

	$effect(() => {
		const q = query.trim();
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			goto(q ? `?q=${encodeURIComponent(q)}` : '?', { replace: true, shallow: true });
			if (!q) {
				results = [];
				return;
			}
			loading = true;
			try {
				results = await search(q, controller.signal);
			} catch {
				if (!controller.signal.aborted) results = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<svelte:head><title>Search · Frostify</title></svelte:head>

<div class="page">
	<label class="box">
		<Icon name="search" />
		<span class="sr-only">Search</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input type="search" placeholder="Titles, people, genres" bind:value={query} autofocus />
		{#if loading}<Spinner size={20} />{/if}
	</label>

	{#if query.trim() && !loading && results.length === 0}
		<p class="muted empty">No matches for “{query.trim()}”.</p>
	{/if}

	<div class="grid">
		{#each results as item (item.ratingKey)}
			<PosterCard {item} />
		{/each}
	</div>
</div>

<style>
	.box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		max-width: 720px;
		padding: 0 1rem;
		margin-bottom: 2rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 1.25rem;
		color: var(--text-dim);
	}
	.box:focus-within {
		border-color: var(--accent);
		box-shadow: var(--glow);
	}
	.box input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		padding: 1rem 0;
		font-size: 1.15rem;
		box-shadow: none;
	}
	.grid {
		--card-w: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1.6rem 1rem;
	}
	.empty {
		font-size: 1.05rem;
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1rem 0.6rem;
		}
	}
</style>
