<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EpisodeList from '#lib/components/EpisodeList.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PlayButton from '#lib/components/PlayButton.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { duration, episodeCode, progress } from '#lib/format.js';
	import { img } from '#lib/plex/images.js';
	import { getChildren, getMetadata, markWatched } from '#lib/plex/library.js';
	import type { Metadata } from '#lib/plex/types.js';

	const key = $derived(page.params.key ?? '');

	let item = $state<Metadata | null>(null);
	let error = $state('');
	let seasons = $state<Metadata[]>([]);
	let seasonKey = $state<string | null>(null);
	let episodes = $state<Metadata[] | null>(null);

	$effect(() => {
		const k = key;
		item = null;
		error = '';
		seasons = [];
		episodes = null;
		getMetadata(k)
			.then(async (m) => {
				if (m.type === 'season' && m.parentRatingKey) {
					goto(`/title/${m.parentRatingKey}?season=${m.ratingKey}`, { replace: true });
					return;
				}
				item = m;
				if (m.type === 'show') {
					seasons = await getChildren(k);
					const wanted = page.url.searchParams.get('season');
					const onDeckSeason = m.OnDeck?.Metadata?.[0]?.parentRatingKey;
					seasonKey =
						seasons.find((s) => s.ratingKey === wanted)?.ratingKey ??
						seasons.find((s) => s.ratingKey === onDeckSeason)?.ratingKey ??
						seasons[0]?.ratingKey ??
						null;
				}
			})
			.catch((e) => (error = e instanceof Error ? e.message : 'Not found'));
	});

	$effect(() => {
		if (!seasonKey) return;
		const k = seasonKey;
		episodes = null;
		getChildren(k).then((eps) => {
			if (seasonKey === k) episodes = eps;
		});
	});

	const art = $derived(item ? img(item.art ?? item.grandparentArt, 1920, 1080) : undefined);
	const poster = $derived(
		item ? img(item.type === 'episode' ? item.grandparentThumb : item.thumb, 300, 450) : undefined
	);
	const pct = $derived(item ? progress(item) : 0);
	const watched = $derived(
		!!item && (item.type === 'show' ? item.leafCount === item.viewedLeafCount : !!item.viewCount)
	);

	async function toggleWatched() {
		if (!item) return;
		await markWatched(item.ratingKey, !watched);
		item = await getMetadata(item.ratingKey);
		if (seasonKey) episodes = await getChildren(seasonKey);
	}
</script>

<svelte:head><title>{item?.title ?? 'Loading'} · Frostify</title></svelte:head>

{#if error}
	<div class="page"><p class="muted">{error}</p></div>
{:else if !item}
	<div class="loading"><Spinner /></div>
{:else}
	<section class="hero">
		{#if art}<img class="art" src={art} alt="" />{/if}
		<div class="shade"></div>
		<div class="content">
			{#if poster}<img class="poster" src={poster} alt="" />{/if}
			<div class="info">
				{#if item.type === 'episode'}
					<a class="show-link" href="/title/{item.grandparentRatingKey}">{item.grandparentTitle}</a>
					<p class="code">{episodeCode(item)}</p>
				{/if}
				<h1>{item.title}</h1>
				{#if item.tagline}<p class="tagline">{item.tagline}</p>{/if}
				<p class="meta">
					{#if item.year}<span>{item.year}</span>{/if}
					{#if item.contentRating}<span class="rating">{item.contentRating}</span>{/if}
					{#if item.type === 'show' && item.childCount}
						<span>{item.childCount} season{item.childCount === 1 ? '' : 's'}</span>
					{:else if item.duration}
						<span>{duration(item.duration)}</span>
					{/if}
					{#if item.audienceRating}
						<span class="score"><Icon name="star" />{item.audienceRating.toFixed(1)}</span>
					{/if}
					{#if item.Media?.[0]?.videoResolution}
						<span class="res">{item.Media[0].videoResolution.toUpperCase()}</span>
					{/if}
				</p>

				{#if pct > 0}
					<div class="resume">
						<div class="progress-track"><div class="progress-fill" style:width="{pct * 100}%"></div></div>
						<span class="muted">{duration((item.duration ?? 0) - (item.viewOffset ?? 0))} left</span>
					</div>
				{/if}

				<div class="actions">
					<PlayButton {item} />
					<button class="btn btn-ghost" onclick={toggleWatched}>
						<Icon name={watched ? 'close' : 'check'} />
						{watched ? 'Mark unwatched' : 'Mark watched'}
					</button>
				</div>

				{#if item.summary}<p class="summary">{item.summary}</p>{/if}

				<dl>
					{#if item.Genre?.length}
						<dt>Genres</dt>
						<dd>{item.Genre.map((g) => g.tag).join(', ')}</dd>
					{/if}
					{#if item.Director?.length}
						<dt>Director</dt>
						<dd>{item.Director.map((d) => d.tag).join(', ')}</dd>
					{/if}
					{#if item.studio}
						<dt>Studio</dt>
						<dd>{item.studio}</dd>
					{/if}
				</dl>
			</div>
		</div>
	</section>

	<div class="body">
		{#if item.type === 'show' && seasons.length}
			<section>
				<div class="season-head">
					<h2>Episodes</h2>
					{#if seasons.length > 1}
						<select bind:value={seasonKey} aria-label="Season">
							{#each seasons as s (s.ratingKey)}<option value={s.ratingKey}>{s.title}</option>{/each}
						</select>
					{:else}
						<span class="muted">{seasons[0].title}</span>
					{/if}
				</div>
				{#if episodes}
					<EpisodeList {episodes} />
				{:else}
					<div class="loading small"><Spinner size={32} /></div>
				{/if}
			</section>
		{/if}

		{#if item.Role?.length}
			<section>
				<h2>Cast</h2>
				<ul class="cast">
					{#each item.Role.slice(0, 20) as r (r.tag + r.role)}
						<li>
							{#if r.thumb}
								<img src={r.thumb} alt="" loading="lazy" />
							{:else}
								<span class="face">{r.tag[0]}</span>
							{/if}
							<strong>{r.tag}</strong>
							{#if r.role}<span class="muted">{r.role}</span>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

<style>
	.loading {
		min-height: 80vh;
		display: grid;
		place-items: center;
	}
	.loading.small {
		min-height: 160px;
	}
	.hero {
		position: relative;
		min-height: 78vh;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 20%;
	}
	.shade {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--bg) 3%, rgb(7 13 26 / 0.75) 40%, rgb(7 13 26 / 0.3) 75%),
			linear-gradient(to right, rgb(7 13 26 / 0.85), transparent 75%);
	}
	.content {
		position: relative;
		display: flex;
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: flex-end;
		padding: calc(var(--nav-h) + 2rem) var(--gutter) 2.5rem;
		width: 100%;
	}
	.poster {
		width: clamp(160px, 18vw, 260px);
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border-radius: 10px;
		box-shadow:
			0 0 0 1px var(--border),
			var(--shadow);
		flex: none;
	}
	.info {
		max-width: 760px;
		min-width: 0;
	}
	.show-link {
		color: var(--accent);
		font-weight: 700;
		font-size: 1.1rem;
	}
	.show-link:hover {
		text-decoration: underline;
	}
	.code {
		margin: 0.2rem 0 0;
		color: var(--text-dim);
	}
	h1 {
		margin: 0.25rem 0 0.4rem;
		font-size: clamp(1.9rem, 4.5vw, 3.4rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	.tagline {
		margin: 0 0 0.6rem;
		font-style: italic;
		color: var(--text-dim);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-dim);
		margin: 0 0 1rem;
	}
	.rating,
	.res {
		border: 1px solid var(--text-dim);
		border-radius: 3px;
		padding: 0 0.35rem;
		font-size: 0.8rem;
	}
	.res {
		border-color: var(--accent);
		color: var(--accent);
	}
	.score {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--accent);
	}
	.resume {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		max-width: 360px;
		margin-bottom: 1rem;
		font-size: 0.85rem;
	}
	.resume .progress-track {
		flex: 1;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.summary {
		line-height: 1.6;
		margin: 0 0 1rem;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 1rem;
		margin: 0;
		font-size: 0.9rem;
	}
	dt {
		color: var(--text-dim);
	}
	dd {
		margin: 0;
	}

	.body {
		padding: 0 var(--gutter) 4rem;
		display: grid;
		gap: 2.5rem;
	}
	h2 {
		font-size: 1.35rem;
		margin: 0 0 1rem;
	}
	.season-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.season-head h2 {
		margin: 0;
	}
	.cast {
		list-style: none;
		margin: 0;
		padding: 0 0 0.5rem;
		display: flex;
		gap: 1.25rem;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.cast li {
		flex: none;
		width: 110px;
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 0.25rem;
		font-size: 0.82rem;
	}
	.cast img,
	.face {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface);
		box-shadow: 0 0 0 2px var(--border);
		margin-bottom: 0.3rem;
	}
	.face {
		display: grid;
		place-items: center;
		font-size: 2rem;
		color: var(--accent);
	}
	@media (max-width: 720px) {
		.content {
			flex-direction: column;
			align-items: flex-start;
		}
		.poster {
			display: none;
		}
	}
</style>
