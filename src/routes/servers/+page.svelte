<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { connect, listServers } from '#lib/plex/servers.js';
	import type { Resource } from '#lib/plex/types.js';
	import { libraries } from '#lib/stores/library.svelte.js';
	import { session } from '#lib/stores/session.svelte.js';

	let servers = $state<Resource[] | null>(null);
	let error = $state('');
	let connecting = $state<string | null>(null);

	onMount(async () => {
		try {
			const list = await listServers(session.token!);
			servers = list;
			// One server and nothing to choose? Go straight in.
			if (list.length === 1) pick(list[0]);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load servers';
		}
	});

	async function pick(res: Resource) {
		connecting = res.clientIdentifier;
		error = '';
		try {
			const conn = await connect(res, session.token!);
			libraries.reset();
			session.setServer(conn);
			await goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Connection failed';
		} finally {
			connecting = null;
		}
	}

	function signOut() {
		session.signOut();
		goto('/login');
	}
</script>

<svelte:head><title>Choose a server · Frostify</title></svelte:head>

<div class="wrap">
	<Logo />
	<h1>Who's serving tonight?</h1>

	{#if !servers && !error}
		<Spinner />
	{:else if servers}
		{#if servers.length === 0}
			<p class="muted">No Plex Media Servers are linked to {session.user?.title ?? 'this account'}.</p>
		{/if}
		<ul>
			{#each servers as s (s.clientIdentifier)}
				<li>
					<button class="server" disabled={!!connecting} onclick={() => pick(s)}>
						<span class="dot" class:online={s.presence}></span>
						<span class="name">
							<strong>{s.name}</strong>
							<span class="muted">
								{s.owned ? 'Your server' : `Shared by ${s.sourceTitle ?? 'a friend'}`}
								{#if s.productVersion}· v{s.productVersion.split('-')[0]}{/if}
							</span>
						</span>
						{#if connecting === s.clientIdentifier}<Spinner size={22} />{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if error}<p class="error">{error}</p>{/if}

	<button class="link" onclick={signOut}>Sign out of {session.user?.title}</button>
</div>

<style>
	.wrap {
		min-height: 100vh;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 1.5rem;
		padding: 32px 16px;
	}
	h1 {
		margin: 1rem 0 0.5rem;
		font-size: clamp(1.5rem, 4vw, 2.4rem);
		text-align: center;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		width: min(460px, 100%);
		display: grid;
		gap: 0.75rem;
	}
	.server {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.2rem;
		text-align: left;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			transform 0.15s;
	}
	.server:hover:not(:disabled) {
		border-color: var(--accent);
		box-shadow: var(--glow);
		transform: translateY(-2px);
	}
	.server:disabled {
		cursor: progress;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-dim);
		flex: none;
	}
	.dot.online {
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}
	.name {
		display: grid;
		gap: 0.2rem;
		flex: 1;
		min-width: 0;
	}
	.name .muted {
		font-size: 0.85rem;
	}
	.error {
		color: var(--danger);
		text-align: center;
		max-width: 460px;
	}
	.link {
		background: none;
		border: 0;
		color: var(--text-dim);
		text-decoration: underline;
		font-size: 0.9rem;
	}
	.link:hover {
		color: var(--accent);
	}
</style>
