<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { openSearch } from '#lib/search.js';
	import { libraries } from '#lib/stores/library.svelte.js';
	import { session } from '#lib/stores/session.svelte.js';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';

	let scrolled = $state(false);
	let menuOpen = $state(false);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	function signOut() {
		menuOpen = false;
		libraries.reset();
		session.signOut();
		goto('/login');
	}

	function switchServer() {
		menuOpen = false;
		libraries.reset();
		session.setServer(null);
		goto('/servers');
	}
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 10)} />

<header class:scrolled>
	<a href="/" class="brand" aria-label="Home"><Logo size={0.8} /></a>

	<nav aria-label="Libraries">
		<a href="/" class:active={isActive('/')}>Home</a>
		{#each libraries.sections as s (s.key)}
			<a href="/library/{s.key}" class:active={isActive(`/library/${s.key}`)}>{s.title}</a>
		{/each}
	</nav>

	<div class="right">
		<button class="icon-link" aria-label="Search" class:active={!!page.state.search} onclick={openSearch}>
			<Icon name="search" />
		</button>
		<div class="account">
			<button
				class="avatar-btn"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{#if session.user?.thumb}
					<img src={session.user.thumb} alt="" />
				{:else}
					<span class="initial">{session.user?.title?.[0] ?? '?'}</span>
				{/if}
				<Icon name="chevronDown" class="caret" />
			</button>
			{#if menuOpen}
				<div class="menu" role="menu">
					<div class="who">
						<strong>{session.user?.title}</strong>
						<span class="muted">{session.server?.name}</span>
					</div>
					<button role="menuitem" onclick={switchServer}>Switch server</button>
					<button role="menuitem" onclick={signOut}>Sign out</button>
				</div>
			{/if}
		</div>
	</div>
</header>

{#if menuOpen}
	<button class="scrim" aria-label="Close menu" onclick={() => (menuOpen = false)}></button>
{/if}

<style>
	header {
		position: fixed;
		inset: 0 0 auto;
		z-index: 50;
		height: var(--nav-h);
		display: flex;
		align-items: center;
		gap: 2rem;
		padding: 0 var(--gutter);
		background: linear-gradient(to bottom, rgb(7 13 26 / 0.85), transparent);
		transition: background 0.3s;
	}
	header.scrolled {
		background: rgb(7 13 26 / 0.92);
		backdrop-filter: blur(12px);
		box-shadow: 0 1px 0 var(--border);
	}
	.brand {
		flex: none;
	}
	nav {
		display: flex;
		gap: 1.25rem;
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
	}
	nav a {
		color: var(--text-dim);
		font-size: 0.92rem;
		white-space: nowrap;
		transition: color 0.15s;
	}
	nav a:hover {
		color: var(--text);
	}
	nav a.active {
		color: var(--text);
		font-weight: 600;
	}
	.right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.icon-link {
		border: 0;
		background: none;
		padding: 0;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		font-size: 1.15rem;
	}
	.icon-link.active,
	.icon-link:hover {
		color: var(--accent);
	}
	.account {
		position: relative;
	}
	.avatar-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: 0;
		padding: 0;
	}
	.avatar-btn img,
	.initial {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		object-fit: cover;
		box-shadow: 0 0 0 2px var(--border);
	}
	.initial {
		display: grid;
		place-items: center;
		background: var(--surface);
		font-weight: 700;
		color: var(--accent);
	}
	.avatar-btn :global(.caret) {
		color: var(--text-dim);
		transition: transform 0.2s;
	}
	.avatar-btn[aria-expanded='true'] :global(.caret) {
		transform: rotate(180deg);
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 12px);
		z-index: 2;
		min-width: 200px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 0.4rem;
		display: grid;
	}
	.who {
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem 0.7rem 0.6rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 0.3rem;
		font-size: 0.9rem;
	}
	.menu button {
		background: none;
		border: 0;
		text-align: left;
		padding: 0.55rem 0.7rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}
	.menu button:hover {
		background: var(--surface);
		color: var(--accent);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: none;
		border: 0;
		cursor: default;
	}
	@media (max-width: 640px) {
		header {
			gap: 1rem;
			padding-top: env(safe-area-inset-top);
			height: calc(var(--nav-h) + env(safe-area-inset-top));
		}
		nav,
		.icon-link {
			display: none;
		}
		.brand :global(.logo) {
			font-size: 0 !important;
		}
		.brand :global(.logo svg) {
			width: 26px;
			height: 26px;
		}
	}
</style>
