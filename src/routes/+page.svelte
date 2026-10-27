<script lang="ts">
	import Hero from '#lib/components/Hero.svelte';
	import Row from '#lib/components/Row.svelte';
	import { getHomeHubs } from '#lib/plex/library.js';
	import type { Hub, Metadata } from '#lib/plex/types.js';

	let hubs = $state<Hub[] | null>(null);
	let error = $state('');

	$effect(() => {
		getHomeHubs()
			.then((h) => (hubs = h))
			.catch((e) => (error = e instanceof Error ? e.message : 'Could not load your library'));
	});

	// Feature something with backdrop art from the "recently added" style hubs.
	const featured = $derived.by((): Metadata | null => {
		if (!hubs) return null;
		const pool = hubs
			.filter((h) => !/continue|ondeck/i.test(h.hubIdentifier))
			.flatMap((h) => h.Metadata ?? [])
			.filter((m) => (m.type === 'movie' || m.type === 'show') && m.art && m.summary);
		return pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 20))] : null;
	});

	const isContinue = (h: Hub) => /continue|ondeck/i.test(h.hubIdentifier);
</script>

<svelte:head><title>Home · Frostify</title></svelte:head>

{#if error}
	<div class="page"><p class="muted">{error}</p></div>
{:else if !hubs}
	<div class="skeleton hero-sk"></div>
	{#each [0, 1, 2] as i (i)}
		<div class="row-sk">
			{#each Array(8) as _, j (j)}<div class="skeleton card-sk"></div>{/each}
		</div>
	{/each}
{:else}
	{#if featured}
		<Hero item={featured} />
	{:else}
		<div style:height="calc(var(--nav-h) + 16px)"></div>
	{/if}
	<div class="rows" class:overlap={!!featured}>
		{#each hubs as hub (hub.hubIdentifier)}
			<Row
				title={hub.title}
				items={hub.Metadata ?? []}
				variant={isContinue(hub) || hub.type === 'episode' ? 'landscape' : 'poster'}
			/>
		{/each}
		{#if hubs.length === 0}
			<p class="page muted">Nothing here yet — add some movies or shows to your Plex server.</p>
		{/if}
	</div>
{/if}

<style>
	.rows {
		position: relative;
		padding-bottom: 4rem;
	}
	.rows.overlap {
		margin-top: -4rem;
	}
	.hero-sk {
		height: 70vh;
		border-radius: 0;
	}
	.row-sk {
		display: flex;
		gap: 0.6rem;
		padding: 2rem var(--gutter) 0;
		overflow: hidden;
	}
	.card-sk {
		flex: none;
		width: 170px;
		aspect-ratio: 2 / 3;
	}
</style>
