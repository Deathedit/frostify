<script lang="ts">
	import { page } from '$app/state';
	import Health from '#lib/components/admin/Health.svelte';
	import History from '#lib/components/admin/History.svelte';
	import Libraries from '#lib/components/admin/Libraries.svelte';
	import NowPlaying from '#lib/components/admin/NowPlaying.svelte';
	import { session } from '#lib/stores/session.svelte.js';

	const TABS = [
		{ id: 'now', label: 'Now Playing' },
		{ id: 'libraries', label: 'Libraries' },
		{ id: 'health', label: 'Server health' },
		{ id: 'history', label: 'Watch history' }
	] as const;

	const tab = $derived(TABS.find((t) => t.id === page.url.searchParams.get('tab'))?.id ?? 'now');
</script>

<svelte:head><title>Admin · Frostify</title></svelte:head>

<div class="page">
	<header>
		<h1>Admin</h1>
		<span class="muted">{session.server?.name}</span>
	</header>

	{#if !session.server?.owned}
		<p class="muted">Only the owner of {session.server?.name ?? 'this server'} can manage it.</p>
	{:else}
		<nav class="tabs" aria-label="Admin sections">
			{#each TABS as t (t.id)}
				<a href="?tab={t.id}" class:active={tab === t.id} aria-current={tab === t.id ? 'page' : undefined}
					data-sveltekit-replacestate data-sveltekit-noscroll>{t.label}</a
				>
			{/each}
		</nav>

		<!-- Each tab mounts only while visible, so its polling stops when you switch away. -->
		{#if tab === 'now'}
			<NowPlaying />
		{:else if tab === 'libraries'}
			<Libraries />
		{:else if tab === 'health'}
			<Health />
		{:else}
			<History />
		{/if}
	{/if}
</div>

<style>
	header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0;
		font-size: clamp(1.6rem, 3vw, 2.2rem);
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs a {
		padding: 0.7rem 1rem;
		white-space: nowrap;
		color: var(--text-dim);
		font-weight: 600;
		font-size: 0.92rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.tabs a:hover {
		color: var(--text);
	}
	.tabs a.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
	@media (max-width: 640px) {
		.tabs {
			margin-inline: calc(-1 * var(--gutter));
			padding-inline: var(--gutter);
		}
		.tabs a {
			padding: 0.6rem 0.75rem;
		}
	}
</style>
