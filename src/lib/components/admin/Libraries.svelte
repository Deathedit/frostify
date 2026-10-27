<script lang="ts">
	import {
		type Activity,
		type AdminSection,
		ago,
		cancelActivity,
		cancelScan,
		cleanBundles,
		emptyTrash,
		getActivities,
		getAllSections,
		getSectionCount,
		optimizeDatabase,
		scanSection
	} from '#lib/plex/admin.js';
	import { poll } from '#lib/poll.js';
	import Icon from '../Icon.svelte';
	import Spinner from '../Spinner.svelte';

	let sections = $state<AdminSection[] | null>(null);
	let counts = $state<Record<string, number>>({});
	let activities = $state<Activity[]>([]);
	let error = $state('');
	let busy = $state<string | null>(null);
	let notice = $state('');

	async function loadSections() {
		try {
			sections = await getAllSections();
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load libraries';
		}
	}

	$effect(() => {
		loadSections().then(() => {
			for (const s of sections ?? []) {
				getSectionCount(s.key).then((n) => (counts[s.key] = n)).catch(() => {});
			}
		});
	});

	// Activities (scans, metadata refreshes, analysis) change quickly; sections only when one finishes.
	$effect(() =>
		poll(async () => {
			const before = activities.length;
			activities = await getActivities();
			if (activities.length < before) loadSections();
		}, 2000)
	);

	async function run(id: string, label: string, action: () => Promise<unknown>, confirmText?: string) {
		if (confirmText && !confirm(confirmText)) return;
		busy = id;
		try {
			await action();
			notice = `${label} started.`;
			setTimeout(() => (notice = ''), 4000);
			activities = await getActivities();
			loadSections();
		} catch (e) {
			notice = `${label} failed: ${e instanceof Error ? e.message : 'unknown error'}`;
		} finally {
			busy = null;
		}
	}

	const TYPE: Record<string, string> = { movie: 'Movies', show: 'TV', artist: 'Music', photo: 'Photos' };
</script>

{#if error}<p class="error">{error}</p>{/if}
{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<section>
	<div class="head">
		<h2>Background activity</h2>
	</div>
	{#if activities.length === 0}
		<p class="muted small">Nothing running.</p>
	{:else}
		<ul class="activities">
			{#each activities as a (a.uuid)}
				<li>
					<div class="a-text">
						<strong>{a.title ?? a.type}</strong>
						{#if a.subtitle}<span class="muted small">{a.subtitle}</span>{/if}
					</div>
					<div class="a-progress">
						<div class="progress-track"><div class="progress-fill" style:width="{a.progress ?? 0}%"></div></div>
						<span class="small">{a.progress ?? 0}%</span>
					</div>
					{#if a.cancellable}
						<button class="link" onclick={() => run(a.uuid, 'Cancel', () => cancelActivity(a.uuid))}>Cancel</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section>
	<div class="head">
		<h2>Libraries</h2>
		<div class="global">
			<button
				title="Scan all libraries"
				aria-label="Scan all libraries"
				class="btn btn-ghost sm"
				disabled={!!busy}
				onclick={() => run('all', 'Scan of all libraries', () => scanSection('all'))}
			>
				<Icon name="scan" />
			</button>
			<button
				title="Clean bundles"
				aria-label="Clean bundles"
				class="btn btn-ghost sm"
				disabled={!!busy}
				onclick={() => run('bundles', 'Clean bundles', cleanBundles, 'Delete unused metadata bundles (posters, art) from the server?')}
			>
				<Icon name="sparkle" />
			</button>
			<button
				title="Optimize database"
				aria-label="Optimize database"
				class="btn btn-ghost sm"
				disabled={!!busy}
				onclick={() => run('optimize', 'Database optimize', optimizeDatabase, 'Optimize the Plex database? The server may be slow while it runs.')}
			>
				<Icon name="bolt" />
			</button>
		</div>
	</div>

	{#if !sections}
		<div class="center"><Spinner /></div>
	{:else}
		<div class="libs">
			{#each sections as s (s.key)}
				<article class="lib">
					<div class="lib-head">
						<div>
							<h3>{s.title}</h3>
							<span class="muted small">
								{TYPE[s.type] ?? s.type}
								{#if counts[s.key] !== undefined}· {counts[s.key].toLocaleString()} items{/if}
							</span>
						</div>
						{#if s.refreshing}
							<span class="scanning"><Spinner size={14} /> Scanning</span>
						{/if}
					</div>
					<dl>
						<dt>Last scan</dt>
						<dd title={s.scannedAt ? new Date(s.scannedAt * 1000).toLocaleString() : ''}>{ago(s.scannedAt)}</dd>
						{#if s.agent}<dt>Agent</dt><dd>{s.agent.replace(/^tv\.plex\.agents\./, '')}</dd>{/if}
						{#each s.Location ?? [] as loc (loc.id)}
							<dt>Folder</dt>
							<dd class="mono">{loc.path}</dd>
						{/each}
					</dl>
					<div class="actions">
						{#if s.refreshing}
							<button
								title="Cancel scan"
								aria-label="Cancel scan"
								class="btn btn-ghost sm"
								disabled={!!busy}
								onclick={() => run(s.key, 'Cancel scan', () => cancelScan(s.key))}
							>
								<Icon name="close" />
							</button>
						{:else}
							<button
								title="Scan files"
								aria-label="Scan files"
								class="btn btn-primary sm"
								disabled={!!busy}
								onclick={() => run(s.key, `Scan of ${s.title}`, () => scanSection(s.key))}
							>
								<Icon name="scan" />
							</button>
						{/if}
						<button
							title="Refresh metadata"
							aria-label="Refresh metadata"
							class="btn btn-ghost sm"
							disabled={!!busy}
							onclick={() =>
								run(s.key + ':meta', `Metadata refresh of ${s.title}`, () => scanSection(s.key, true),
									`Re-download metadata for everything in ${s.title}? This can take a long time on big libraries.`)}
						>
							<Icon name="refresh" />
						</button>
						<button
							title="Empty trash"
							aria-label="Empty trash"
							class="btn btn-ghost sm"
							disabled={!!busy}
							onclick={() =>
								run(s.key + ':trash', `Empty trash of ${s.title}`, () => emptyTrash(s.key),
									`Permanently remove items in ${s.title} whose files are missing?`)}
						>
							<Icon name="trash" />
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	section + section {
		margin-top: 2rem;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	h3 {
		margin: 0 0 0.15rem;
		font-size: 1.05rem;
	}
	.global,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.actions {
		margin-top: auto;
	}
	/* icon-only action buttons; the label lives in title + aria-label */
	.sm {
		width: 2.4rem;
		height: 2.4rem;
		padding: 0;
		font-size: 1.15rem;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.small {
		font-size: 0.82rem;
	}
	.error {
		color: var(--danger);
	}
	.notice {
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		background: var(--bg-elev);
	}
	.center {
		display: grid;
		place-items: center;
		min-height: 160px;
	}
	.activities {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.activities li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(120px, 220px) auto;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 1rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.a-text {
		display: grid;
		min-width: 0;
	}
	.a-text > * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.a-progress {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.a-progress .progress-track {
		flex: 1;
	}
	.link {
		background: none;
		border: 0;
		color: var(--text-dim);
		text-decoration: underline;
		font-size: 0.85rem;
	}
	.link:hover {
		color: var(--danger);
	}
	.libs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: 1rem;
	}
	.lib {
		/* column flex + margin-top:auto on .actions keeps buttons on one line across a row of cards */
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem 1.1rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 12px;
		min-width: 0;
	}
	.lib-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.scanning {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--accent);
	}
	dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.3rem 0.9rem;
		margin: 0;
		font-size: 0.85rem;
	}
	dt {
		color: var(--text-dim);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.8rem;
	}
	@media (max-width: 640px) {
		.activities li {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.a-progress {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
