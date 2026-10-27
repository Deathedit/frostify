<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { authAppUrl, createPin, getUser, waitForPin } from '#lib/plex/auth.js';
	import { session } from '#lib/stores/session.svelte.js';

	const PENDING_KEY = 'frostify.pendingPin';

	let status = $state<'idle' | 'waiting' | 'error'>('idle');
	let error = $state('');
	let controller: AbortController | null = null;

	async function finish(pinId: number, popup?: Window | null) {
		status = 'waiting';
		controller = new AbortController();
		try {
			const token = await waitForPin(pinId, controller.signal);
			popup?.close();
			sessionStorage.removeItem(PENDING_KEY);
			session.signIn(token, await getUser(token));
			await goto('/servers');
		} catch (e) {
			status = 'error';
			error = e instanceof Error ? e.message : 'Sign-in failed';
		}
	}

	async function signIn() {
		error = '';
		// Open the window synchronously so popup blockers treat it as user-initiated.
		const popup = window.open('', 'plex-auth', 'width=600,height=720');
		try {
			const pin = await createPin();
			if (popup) {
				popup.location.href = authAppUrl(pin.code);
				finish(pin.id, popup);
			} else {
				// Popup blocked: do a full redirect and resume polling when Plex sends us back.
				sessionStorage.setItem(PENDING_KEY, String(pin.id));
				location.href = authAppUrl(pin.code, `${location.origin}/login`);
			}
		} catch (e) {
			popup?.close();
			status = 'error';
			error = e instanceof Error ? e.message : 'Could not reach plex.tv';
		}
	}

	function cancel() {
		controller?.abort();
		status = 'idle';
	}

	onMount(() => {
		if (session.token) {
			goto(session.server ? '/' : '/servers');
			return;
		}
		const pending = sessionStorage.getItem(PENDING_KEY);
		if (pending) finish(Number(pending));
		return () => controller?.abort();
	});
</script>

<svelte:head><title>Sign in · Frostify</title></svelte:head>

<div class="login">
	<div class="aurora"></div>
	<div class="card">
		<Logo size={1.4} />
		<p class="tag">Your Plex library, on ice.</p>

		{#if status === 'waiting'}
			<div class="waiting">
				<Spinner />
				<p>Finish signing in on the Plex window…</p>
				<button class="btn btn-ghost" onclick={cancel}>Cancel</button>
			</div>
		{:else}
			<button class="btn btn-primary big" onclick={signIn}>Sign in with Plex</button>
			{#if error}<p class="error">{error}</p>{/if}
			<p class="muted small">
				You'll be sent to plex.tv to approve Frostify. Your password is never shared with this app.
			</p>
		{/if}
	</div>
</div>

<style>
	.login {
		position: relative;
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 16px;
		overflow: hidden;
	}
	.aurora {
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(40% 35% at 25% 30%, rgb(56 189 248 / 0.22), transparent 70%),
			radial-gradient(35% 30% at 75% 70%, rgb(125 211 252 / 0.14), transparent 70%),
			radial-gradient(30% 25% at 60% 20%, rgb(99 102 241 / 0.12), transparent 70%);
		filter: blur(30px);
		animation: drift 18s ease-in-out infinite alternate;
	}
	@keyframes drift {
		to {
			transform: translate(4%, -3%) rotate(4deg);
		}
	}
	.card {
		position: relative;
		width: min(420px, 100%);
		display: grid;
		justify-items: center;
		gap: 1.25rem;
		text-align: center;
		padding: 2.5rem 2rem;
		background: rgb(14 26 46 / 0.7);
		border: 1px solid var(--border);
		border-radius: 16px;
		backdrop-filter: blur(16px);
		box-shadow: var(--shadow);
	}
	.tag {
		margin: -0.5rem 0 0.5rem;
		color: var(--text-dim);
	}
	.big {
		width: 100%;
		padding: 0.95rem;
		font-size: 1.05rem;
	}
	.small {
		font-size: 0.82rem;
		line-height: 1.5;
		margin: 0;
	}
	.waiting {
		display: grid;
		justify-items: center;
		gap: 1rem;
	}
	.waiting p {
		margin: 0;
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
</style>
