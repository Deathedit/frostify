<script lang="ts">
	export interface Series {
		name: string;
		color: string;
		values: (number | null)[];
	}

	let {
		title,
		times,
		series,
		max,
		format,
		height = 170
	}: {
		title: string;
		/** unix seconds, one per value */
		times: number[];
		series: Series[];
		/** fixed y max (e.g. 100 for %); otherwise a rounded-up data max */
		max?: number;
		format: (v: number) => string;
		height?: number;
	} = $props();

	const M = { top: 10, right: 64, bottom: 22, left: 44 };
	let width = $state(600);
	let hover = $state<number | null>(null);

	const innerW = $derived(Math.max(10, width - M.left - M.right));
	const innerH = $derived(height - M.top - M.bottom);

	function niceMax(v: number): number {
		if (v <= 0) return 1;
		const p = 10 ** Math.floor(Math.log10(v));
		for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
		return 10 * p;
	}
	const yMax = $derived(
		max ?? niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v != null))))
	);
	const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax));

	const x = (i: number) => M.left + (times.length < 2 ? innerW : (i / (times.length - 1)) * innerW);
	const y = (v: number) => M.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

	function path(values: (number | null)[]): string {
		let d = '';
		let pen = false;
		values.forEach((v, i) => {
			if (v == null) {
				pen = false;
				return;
			}
			d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
			pen = true;
		});
		return d;
	}

	const clock = (t: number) =>
		new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

	// Direct labels at each line's latest value, nudged apart so they never overlap.
	const endLabels = $derived.by(() => {
		const out = series
			.map((s) => {
				const i = s.values.findLastIndex((v) => v != null);
				return i < 0 ? null : { s, i, v: s.values[i] as number, ly: y(s.values[i] as number) };
			})
			.filter((l) => l !== null)
			.sort((a, b) => a.ly - b.ly);
		for (let k = 1; k < out.length; k++) {
			if (out[k].ly - out[k - 1].ly < 14) out[k].ly = out[k - 1].ly + 14;
		}
		return out;
	});

	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const f = (e.clientX - rect.left) / rect.width;
		hover = times.length ? Math.round(f * (times.length - 1)) : null;
	}

	const tipLeft = $derived(hover == null ? 0 : Math.min(x(hover) + 12, width - 170));
</script>

<figure class="chart" bind:clientWidth={width}>
	<figcaption>
		<span class="title">{title}</span>
		{#if series.length > 1}
			<span class="legend">
				{#each series as s (s.name)}
					<span class="key"><span class="swatch" style:background={s.color}></span>{s.name}</span>
				{/each}
			</span>
		{/if}
	</figcaption>

	<div class="plot">
		<svg {width} {height} role="img" aria-label="{title} over the last {times.length} samples">
			{#each ticks as t, i (i)}
				<line class="grid" x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} />
				<text class="axis" x={M.left - 8} y={y(t)} dy="0.32em" text-anchor="end">{format(t)}</text>
			{/each}
			{#if times.length > 1}
				<text class="axis" x={M.left} y={height - 4}>{clock(times[0])}</text>
				<text class="axis" x={M.left + innerW} y={height - 4} text-anchor="end">{clock(times[times.length - 1])}</text>
			{/if}

			{#each series as s (s.name)}
				<path d={path(s.values)} stroke={s.color} />
			{/each}

			{#each endLabels as l (l.s.name)}
				<circle cx={x(l.i)} cy={y(l.v)} r="4" fill={l.s.color} class="dot" />
				<text class="end" x={M.left + innerW + 8} y={l.ly} dy="0.32em">{format(l.v)}</text>
			{/each}

			{#if hover != null}
				<line class="cross" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} />
				{#each series as s (s.name)}
					{#if s.values[hover] != null}
						<circle cx={x(hover)} cy={y(s.values[hover] as number)} r="5" fill={s.color} class="dot" />
					{/if}
				{/each}
			{/if}

			<rect
				class="hit"
				x={M.left}
				y={M.top}
				width={innerW}
				height={innerH}
				role="presentation"
				onpointermove={onMove}
				onpointerleave={() => (hover = null)}
			/>
		</svg>

		{#if hover != null && times[hover]}
			<div class="tip" style:left="{tipLeft}px">
				<div class="tip-time">{clock(times[hover])}</div>
				{#each series as s (s.name)}
					<div class="tip-row">
						<span class="swatch" style:background={s.color}></span>
						<span>{s.name}</span>
						<strong>{s.values[hover] == null ? '—' : format(s.values[hover] as number)}</strong>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<table class="sr-only">
		<caption>{title}</caption>
		<thead>
			<tr><th>Time</th>{#each series as s (s.name)}<th>{s.name}</th>{/each}</tr>
		</thead>
		<tbody>
			{#each times as t, i (t)}
				<tr>
					<td>{clock(t)}</td>
					{#each series as s (s.name)}<td>{s.values[i] == null ? '—' : format(s.values[i] as number)}</td>{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</figure>

<style>
	.chart {
		margin: 0;
		padding: 1rem 1rem 0.5rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		min-width: 0;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.title {
		font-weight: 700;
		font-size: 0.95rem;
	}
	.legend {
		display: flex;
		gap: 0.9rem;
		font-size: 0.8rem;
		color: var(--text-dim);
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex: none;
	}
	.plot {
		position: relative;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--border);
		stroke-width: 1;
		opacity: 0.6;
	}
	.axis {
		fill: var(--text-dim);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}
	path {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.dot {
		stroke: var(--bg-elev);
		stroke-width: 2;
	}
	.end {
		fill: var(--text);
		font-size: 11px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.cross {
		stroke: var(--text-dim);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.hit {
		fill: transparent;
		cursor: crosshair;
	}
	.tip {
		position: absolute;
		top: 0;
		width: 160px;
		pointer-events: none;
		padding: 0.5rem 0.6rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: var(--shadow);
		font-size: 0.78rem;
	}
	.tip-time {
		color: var(--text-dim);
		margin-bottom: 0.3rem;
		font-variant-numeric: tabular-nums;
	}
	.tip-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.tip-row strong {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
</style>
