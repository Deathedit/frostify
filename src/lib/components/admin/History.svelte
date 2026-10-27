<script lang="ts">
	import { untrack } from 'svelte';
	import { displayTitle, episodeCode } from '#lib/format.js';
	import {
		type Account,
		type AdminSection,
		type Device,
		type HistoryItem,
		ago,
		getAccounts,
		getAllSections,
		getDevices,
		getHistory
	} from '#lib/plex/admin.js';
	import { img } from '#lib/plex/images.js';
	import { session } from '#lib/stores/session.svelte.js';
	import Select from '../Select.svelte';
	import Spinner from '../Spinner.svelte';

	const PAGE = 50;

	let accounts = $state<Account[]>([]);
	let devices = $state<Device[]>([]);
	let sections = $state<AdminSection[]>([]);
	let accountId = $state('');
	let sectionId = $state('');
	let items = $state<HistoryItem[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let error = $state('');
	let generation = 0;

	$effect(() => {
		getAccounts().then((a) => (accounts = a)).catch(() => {});
		getDevices().then((d) => (devices = d)).catch(() => {});
		getAllSections().then((s) => (sections = s)).catch(() => {});
	});

	async function load(reset: boolean) {
		const gen = reset ? ++generation : generation;
		loading = true;
		try {
			const res = await getHistory({
				start: reset ? 0 : items.length,
				size: PAGE,
				accountID: accountId ? Number(accountId) : undefined,
				librarySectionID: sectionId || undefined
			});
			if (gen !== generation) return;
			items = reset ? res.items : [...items, ...res.items];
			total = res.total;
			error = '';
		} catch (e) {
			if (gen === generation) error = e instanceof Error ? e.message : 'Could not load history';
		} finally {
			if (gen === generation) loading = false;
		}
	}

	$effect(() => {
		void [accountId, sectionId];
		untrack(() => load(true));
	});

	// The owner's account (id 1) often has an empty name in /accounts.
	function accountName(id: number | undefined): string {
		const a = accounts.find((x) => x.id === id);
		if (a?.name) return a.name;
		return id === 1 ? (session.user?.title ?? 'Owner') : `User ${id ?? '?'}`;
	}
	const deviceName = (id: number | undefined) => devices.find((d) => d.id === id)?.name ?? '—';

	// Per-user play counts across the rows loaded so far.
	const perUser = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const i of items) counts.set(i.accountID ?? 0, (counts.get(i.accountID ?? 0) ?? 0) + 1);
		return [...counts.entries()].sort((a, b) => b[1] - a[1]);
	});
	const topCount = $derived(perUser[0]?.[1] ?? 1);
</script>

<div class="filters">
	<div class="field">
		<span class="muted small">User</span>
		<Select
			bind:value={accountId}
			label="User"
			options={[
				{ value: '', label: 'Everyone' },
				...accounts.map((a) => ({ value: String(a.id), label: accountName(a.id) }))
			]}
		/>
	</div>
	<div class="field">
		<span class="muted small">Library</span>
		<Select
			bind:value={sectionId}
			label="Library"
			options={[{ value: '', label: 'All libraries' }, ...sections.map((s) => ({ value: s.key, label: s.title }))]}
		/>
	</div>
	<span class="muted small count">{total ? `${total.toLocaleString()} plays` : ''}</span>
</div>

{#if error}<p class="error">{error}</p>{/if}

{#if !accountId && perUser.length > 1}
	<section class="users">
		<h3 class="muted small">Plays by user · latest {items.length}</h3>
		<ul>
			{#each perUser as [id, n] (id)}
				<li>
					<span class="name">{accountName(id)}</span>
					<span class="bar"><span style:width="{(n / topCount) * 100}%"></span></span>
					<span class="n">{n}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<ul class="history">
	{#each items as h (h.historyKey)}
		<li>
			<span class="thumb">
				{#if h.thumb || h.grandparentThumb}
					<img src={img(h.type === 'episode' ? (h.grandparentThumb ?? h.thumb) : h.thumb, 40, 60)} alt="" loading="lazy" />
				{/if}
			</span>
			<span class="what">
				<strong>{displayTitle(h)}</strong>
				<span class="muted small">{h.type === 'episode' ? `${episodeCode(h)} — ${h.title}` : (h.year ?? '')}</span>
			</span>
			<span class="who small">{accountName(h.accountID)}<span class="muted"> · {deviceName(h.deviceID)}</span></span>
			<time class="muted small" datetime={new Date(h.viewedAt * 1000).toISOString()} title={new Date(h.viewedAt * 1000).toLocaleString()}>
				{ago(h.viewedAt)}
			</time>
		</li>
	{/each}
</ul>

{#if loading}
	<div class="center"><Spinner size={32} /></div>
{:else if items.length === 0}
	<p class="muted">No plays recorded.</p>
{:else if items.length < total}
	<div class="center"><button class="btn btn-ghost" onclick={() => load(false)}>Load more</button></div>
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.field {
		display: grid;
		gap: 0.3rem;
	}
	.count {
		margin-left: auto;
	}
	.small {
		font-size: 0.82rem;
	}
	.error {
		color: var(--danger);
	}
	.users {
		margin-bottom: 1.5rem;
		padding: 1rem 1.2rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		max-width: 560px;
	}
	.users h3 {
		margin: 0 0 0.6rem;
		font-weight: 600;
	}
	.users ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.users li {
		display: grid;
		grid-template-columns: minmax(80px, 140px) minmax(0, 1fr) 2.5rem;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		height: 8px;
		border-radius: 4px;
		background: var(--surface);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: var(--series-1);
	}
	.n {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.history {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.history li {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) minmax(0, 220px) 7rem;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 0.4rem;
		border-bottom: 1px solid var(--border);
	}
	.thumb {
		width: 40px;
		aspect-ratio: 2 / 3;
		border-radius: 4px;
		overflow: hidden;
		background: var(--surface);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.what {
		display: grid;
		min-width: 0;
	}
	.what > *,
	.who {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	time {
		text-align: right;
	}
	.center {
		display: grid;
		place-items: center;
		padding: 1.5rem 0;
	}
	@media (max-width: 640px) {
		.history li {
			grid-template-columns: 40px minmax(0, 1fr) auto;
			gap: 0.4rem 0.8rem;
		}
		.who {
			grid-column: 2 / -1;
			grid-row: 2;
		}
		.thumb {
			grid-row: 1 / 3;
		}
		.count {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
