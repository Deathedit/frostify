<script lang="ts">
	import { page } from '$app/state';
	import { openSearch } from '#lib/search.js';
	import { libraries } from '#lib/stores/library.svelte.js';
	import Icon from './Icon.svelte';

	const isActive = (href: string) =>
		!page.state.search &&
		(href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<!-- Phone-only bottom navigation; hidden above 640px where the top nav has room for links. -->
<nav class="tabbar" aria-label="Main">
	<a href="/" class:active={isActive('/')}><Icon name="home" /><span>Home</span></a>
	{#each libraries.sections as s (s.key)}
		<a href="/library/{s.key}" class:active={isActive(`/library/${s.key}`)}>
			<Icon name={s.type === 'show' ? 'tv' : 'film'} /><span>{s.title}</span>
		</a>
	{/each}
	<button class:active={!!page.state.search} onclick={openSearch}><Icon name="search" /><span>Search</span></button>
</nav>

<style>
	.tabbar {
		display: none;
	}
	@media (max-width: 640px) {
		.tabbar {
			position: fixed;
			inset: auto 0 0;
			z-index: 50;
			display: flex;
			height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
			padding-bottom: env(safe-area-inset-bottom);
			background: rgb(7 13 26 / 0.94);
			backdrop-filter: blur(12px);
			box-shadow: 0 -1px 0 var(--border);
		}
		a,
		button {
			flex: 1;
			border: 0;
			background: none;
			padding: 0;
			min-width: 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			font-size: 0.68rem;
			color: var(--text-dim);
		}
		:is(a, button) :global(.icon) {
			font-size: 1.35rem;
		}
		:is(a, button) span {
			max-width: 100%;
			padding: 0 4px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.active {
			color: var(--accent);
		}
		.active :global(.icon) {
			filter: drop-shadow(0 0 6px rgb(125 211 252 / 0.6));
		}
	}
</style>
