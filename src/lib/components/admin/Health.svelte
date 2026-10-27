<script lang="ts">
	import {
		type BandwidthSample,
		type ButlerTask,
		type ResourceSample,
		type ServerInfo,
		getBandwidth,
		getButlerTasks,
		getResources,
		getServerInfo,
		runButlerTask
	} from '#lib/plex/admin.js';
	import { poll } from '#lib/poll.js';
	import { session } from '#lib/stores/session.svelte.js';
	import Icon from '../Icon.svelte';
	import LineChart from './LineChart.svelte';

	const WINDOW = 10 * 60; // keep ten minutes of samples

	let info = $state<ServerInfo | null>(null);
	let resources = $state<ResourceSample[]>([]);
	let bandwidth = $state<{ at: number; lan: number; wan: number }[]>([]);
	let tasks = $state<ButlerTask[] | null>(null);
	let error = $state('');
	let running = $state<string | null>(null);
	let notice = $state('');

	$effect(() => {
		getServerInfo().then((i) => (info = i)).catch(() => {});
		getButlerTasks().then((t) => (tasks = t)).catch(() => (tasks = []));
	});

	function mergeResources(fresh: ResourceSample[]) {
		const byAt = new Map(resources.map((r) => [r.at, r]));
		for (const r of fresh) byAt.set(r.at, r);
		const cutoff = Date.now() / 1000 - WINDOW;
		resources = [...byAt.values()].filter((r) => r.at >= cutoff).sort((a, b) => a.at - b.at);
	}

	function mergeBandwidth(fresh: BandwidthSample[]) {
		const byAt = new Map(bandwidth.map((b) => [b.at, { ...b }]));
		// Plex reports one row per account/device; sum them per timestamp and side.
		const freshByAt = new Map<number, { at: number; lan: number; wan: number }>();
		for (const s of fresh) {
			const row = freshByAt.get(s.at) ?? { at: s.at, lan: 0, wan: 0 };
			const mbps = (s.bytes * 8) / (s.timespan || 6) / 1e6;
			if (s.lan) row.lan += mbps;
			else row.wan += mbps;
			freshByAt.set(s.at, row);
		}
		for (const [at, row] of freshByAt) byAt.set(at, row);
		const cutoff = Date.now() / 1000 - WINDOW;
		bandwidth = [...byAt.values()].filter((b) => b.at >= cutoff).sort((a, b) => a.at - b.at);
	}

	$effect(() =>
		poll(async () => {
			try {
				const [r, b] = await Promise.all([getResources(), getBandwidth()]);
				mergeResources(r);
				mergeBandwidth(b);
				error = '';
			} catch (e) {
				error = e instanceof Error ? e.message : 'Could not load server statistics';
			}
		}, 6000)
	);

	const latest = $derived(resources.at(-1));
	const latestBw = $derived(bandwidth.at(-1));
	const pct = (v: number) => `${Math.round(v)}%`;
	const mbps = (v: number) => (v >= 10 ? `${Math.round(v)} Mbps` : `${v.toFixed(1)} Mbps`);

	function interval(days: number | undefined) {
		if (!days) return '—';
		return days === 1 ? 'Daily' : days === 7 ? 'Weekly' : `Every ${days} days`;
	}

	async function runTask(t: ButlerTask) {
		if (!confirm(`Run "${t.title ?? t.name}" now?`)) return;
		running = t.name;
		try {
			await runButlerTask(t.name);
			notice = `${t.title ?? t.name} started.`;
		} catch (e) {
			notice = `Could not start ${t.title ?? t.name}: ${e instanceof Error ? e.message : 'unknown error'}`;
		} finally {
			running = null;
			setTimeout(() => (notice = ''), 4000);
		}
	}
</script>

{#if error}<p class="error">{error}</p>{/if}

<section class="server">
	<div>
		<h2>{info?.friendlyName ?? session.server?.name ?? 'Server'}</h2>
		<p class="muted">
			{#if info}
				Plex Media Server {info.version?.split('-')[0]} · {info.platform} {info.platformVersion}
				{#if info.myPlexUsername}· signed in as {info.myPlexUsername}{/if}
			{:else}
				Loading…
			{/if}
		</p>
	</div>
	<div class="tiles">
		<div class="tile">
			<span class="label muted">Plex CPU</span>
			<span class="num">{latest?.processCpuUtilization != null ? pct(latest.processCpuUtilization) : '—'}</span>
			<span class="sub muted">host {latest?.hostCpuUtilization != null ? pct(latest.hostCpuUtilization) : '—'}</span>
		</div>
		<div class="tile">
			<span class="label muted">Plex memory</span>
			<span class="num">{latest?.processMemoryUtilization != null ? pct(latest.processMemoryUtilization) : '—'}</span>
			<span class="sub muted">host {latest?.hostMemoryUtilization != null ? pct(latest.hostMemoryUtilization) : '—'}</span>
		</div>
		<div class="tile">
			<span class="label muted">Bandwidth</span>
			<span class="num">{latestBw ? mbps(latestBw.lan + latestBw.wan) : '—'}</span>
			<span class="sub muted">{latestBw ? `LAN ${mbps(latestBw.lan)} · remote ${mbps(latestBw.wan)}` : 'no traffic yet'}</span>
		</div>
		<div class="tile">
			<span class="label muted">Video transcodes</span>
			<span class="num">{info?.transcoderActiveVideoSessions ?? '—'}</span>
			<span class="sub muted">right now</span>
		</div>
	</div>
</section>

<section class="charts">
	<LineChart
		title="CPU usage"
		times={resources.map((r) => r.at)}
		max={100}
		format={pct}
		series={[
			{ name: 'Host', color: 'var(--series-1)', values: resources.map((r) => r.hostCpuUtilization ?? null) },
			{ name: 'Plex', color: 'var(--series-2)', values: resources.map((r) => r.processCpuUtilization ?? null) }
		]}
	/>
	<LineChart
		title="Memory usage"
		times={resources.map((r) => r.at)}
		max={100}
		format={pct}
		series={[
			{ name: 'Host', color: 'var(--series-1)', values: resources.map((r) => r.hostMemoryUtilization ?? null) },
			{ name: 'Plex', color: 'var(--series-2)', values: resources.map((r) => r.processMemoryUtilization ?? null) }
		]}
	/>
	<LineChart
		title="Bandwidth"
		times={bandwidth.map((b) => b.at)}
		format={mbps}
		series={[
			{ name: 'LAN', color: 'var(--series-1)', values: bandwidth.map((b) => b.lan) },
			{ name: 'Remote', color: 'var(--series-2)', values: bandwidth.map((b) => b.wan) }
		]}
	/>
</section>
<p class="muted small">Live view: samples every ~6 s, last 10 minutes, while this tab is open.</p>

<section>
	<h2>Scheduled tasks</h2>
	{#if notice}<p class="notice" role="status">{notice}</p>{/if}
	{#if !tasks}
		<p class="muted">Loading…</p>
	{:else if tasks.length === 0}
		<p class="muted">No scheduled tasks reported by this server.</p>
	{:else}
		<ul class="tasks">
			{#each tasks as t (t.name)}
				<li>
					<div class="t-text">
						<strong>{t.title ?? t.name}</strong>
						{#if t.description}<span class="muted small">{t.description}</span>{/if}
					</div>
					<span class="small muted when">{t.enabled ? interval(t.interval) : 'Disabled'}</span>
					<button class="btn btn-ghost sm" disabled={running === t.name} onclick={() => runTask(t)}>
						<Icon name="play" /> Run now
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	section + section,
	.charts + p + section {
		margin-top: 2rem;
	}
	h2 {
		margin: 0 0 0.25rem;
		font-size: 1.2rem;
	}
	.error {
		color: var(--danger);
	}
	.small {
		font-size: 0.82rem;
	}
	.server p {
		margin: 0 0 1rem;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 1rem;
	}
	.tile {
		display: grid;
		gap: 0.15rem;
		padding: 1rem 1.2rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.label {
		font-size: 0.8rem;
	}
	.num {
		font-size: 1.8rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.sub {
		font-size: 0.78rem;
	}
	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
		gap: 1rem;
	}
	.notice {
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		background: var(--bg-elev);
	}
	.tasks {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.tasks li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 1rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.t-text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.sm {
		padding: 0.45rem 0.8rem;
		font-size: 0.82rem;
		gap: 0.35rem;
	}
	@media (max-width: 640px) {
		.tasks li {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.when {
			grid-column: 1;
			grid-row: 2;
		}
	}
</style>
