<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import PosterCard from '#lib/components/PosterCard.svelte';
	import Select from '#lib/components/Select.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { SORTS, getSectionItems } from '#lib/plex/library.js';
	import type { Metadata } from '#lib/plex/types.js';
	import { libraries } from '#lib/stores/library.svelte.js';

	const PAGE = 60;

	const id = $derived(page.params.id ?? '');
	const section = $derived(libraries.sections.find((s) => s.key === id));

	let sort = $state<string>(SORTS[1].value);
	let items = $state<Metadata[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let error = $state('');
	let generation = 0;
	let sentinel = $state<HTMLDivElement>();

	async function loadMore(reset = false) {
		if (loading && !reset) return;
		const gen = reset ? ++generation : generation;
		loading = true;
		try {
			const res = await getSectionItems(id, {
				start: reset ? 0 : items.length,
				size: PAGE,
				sort
			});
			if (gen !== generation) return;
			items = reset ? res.items : [...items, ...res.items];
			total = res.total;
			error = '';
		} catch (e) {
			if (gen === generation) error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			if (gen === generation) loading = false;
		}
	}

	// Reload from scratch whenever the library, sort or filter changes.
	$effect(() => {
		void [id, sort];
		// loadMore reads `loading`/`items`; untracked so finishing a fetch doesn't restart this effect.
		untrack(() => {
			items = [];
			total = 0;
			loadMore(true);
		});
	});

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && items.length < total) untrack(() => loadMore());
			},
			{ rootMargin: '800px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

<svelte:head><title>{section?.title ?? 'Library'} · Frostify</title></svelte:head>

<div class="page">
	<header>
		<h1>{section?.title ?? 'Library'}</h1>
		<span class="muted count">{total ? `${total} titles` : ''}</span>
		<div class="filters">
			<Select bind:value={sort} label="Sort by" options={SORTS.map((s) => ({ ...s }))} />
		</div>
	</header>

	{#if error}<p class="muted">{error}</p>{/if}

	<div class="grid">
		{#each items as item (item.ratingKey)}
			<PosterCard {item} />
		{/each}
		{#if loading && items.length === 0}
			{#each Array(18) as _, i (i)}<div class="skeleton sk"></div>{/each}
		{/if}
	</div>

	<div bind:this={sentinel} class="sentinel">
		{#if loading && items.length > 0}<Spinner size={32} />{/if}
	</div>
</div>

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1rem;
		margin-bottom: 1.5rem;
	}
	h1 {
		margin: 0;
		font-size: clamp(1.6rem, 3vw, 2.2rem);
	}
	.filters {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.grid {
		--card-w: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1.6rem 1rem;
	}
	.sk {
		aspect-ratio: 2 / 3;
	}
	.sentinel {
		display: grid;
		place-items: center;
		min-height: 80px;
	}
	@media (max-width: 640px) {
		.grid {
			--card-w: 100%;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1rem 0.6rem;
		}
		header {
			margin-bottom: 1rem;
		}
		.filters {
			margin-left: 0;
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
