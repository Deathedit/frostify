<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import Nav from '#lib/components/Nav.svelte';
	import { libraries } from '#lib/stores/library.svelte.js';
	import { session } from '#lib/stores/session.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const chromeless = $derived(
		['/login', '/servers'].includes(page.url.pathname) || page.url.pathname.startsWith('/watch/')
	);

	$effect(() => {
		if (session.server) libraries.load(session.server.clientIdentifier);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Frostify</title>
</svelte:head>

{#if !chromeless && session.server}
	<Nav />
{/if}

<main>
	{@render children()}
</main>
