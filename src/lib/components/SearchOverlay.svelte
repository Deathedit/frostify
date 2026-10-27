<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { displayTitle, subtitle } from '#lib/format.js';
	import { img } from '#lib/plex/images.js';
	import { search } from '#lib/plex/library.js';
	import type { Metadata } from '#lib/plex/types.js';
	import { closeSearch, openSearch } from '#lib/search.js';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';

	const TYPE_LABEL: Record<string, string> = { movie: 'Movie', show: 'Show', episode: 'Episode' };

	const open = $derived(!!page.state.search);

	// Query and results survive closing, so reopening picks up where you left off.
	let query = $state('');
	let results = $state<Metadata[]>([]);
	let loading = $state(false);
	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let list = $state<HTMLUListElement>();

	$effect(() => {
		if (!open) return;
		tick().then(() => input?.select());
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});

	$effect(() => {
		const q = query.trim();
		if (!q) {
			results = [];
			loading = false;
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			loading = true;
			try {
				results = await search(q, controller.signal);
				active = 0;
			} catch {
				if (!controller.signal.aborted) results = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function hrefFor(item: Metadata) {
		return `/title/${item.ratingKey}`;
	}

	// Replace the overlay's history entry so Back from the result skips the closed overlay.
	function select(item: Metadata) {
		goto(hrefFor(item), { replace: true });
	}

	function move(delta: number) {
		if (!results.length) return;
		active = (active + delta + results.length) % results.length;
		tick().then(() =>
			list?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
		);
	}

	function onInputKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') move(1);
		else if (e.key === 'ArrowUp') move(-1);
		else if (e.key === 'Enter' && results[active]) select(results[active]);
		else return;
		e.preventDefault();
	}

	function onWindowKey(e: KeyboardEvent) {
		if (open) {
			if (e.key === 'Escape') {
				e.preventDefault();
				closeSearch();
			}
			return;
		}
		const typing =
			e.target instanceof HTMLInputElement ||
			e.target instanceof HTMLTextAreaElement ||
			e.target instanceof HTMLSelectElement;
		if ((e.key === '/' && !typing) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
			e.preventDefault();
			openSearch();
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} />

{#if open}
	<div class="overlay" transition:fade={{ duration: 150 }}>
		<button class="scrim" aria-label="Close search" tabindex="-1" onclick={closeSearch}></button>

		<div class="panel" role="dialog" aria-modal="true" aria-label="Search" transition:fly={{ y: -16, duration: 200 }}>
			<label class="box">
				<Icon name="search" />
				<span class="sr-only">Search</span>
				<input
					bind:this={input}
					bind:value={query}
					type="search"
					placeholder="Search movies, shows, episodes"
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-expanded={results.length > 0}
					aria-controls="search-results"
					aria-activedescendant={results.length ? `search-opt-${active}` : undefined}
					onkeydown={onInputKey}
				/>
				{#if loading}<Spinner size={20} />{/if}
				<button class="close" aria-label="Close search" onclick={closeSearch}>
					<span class="esc">Esc</span><Icon name="close" class="x" />
				</button>
			</label>

			<div class="body">
				{#if !query.trim()}
					<p class="hint muted">
						Type to search your libraries.
						<span class="keys"><kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> opens search anywhere.</span>
					</p>
				{:else if !loading && results.length === 0}
					<p class="hint muted">No matches for “{query.trim()}”.</p>
				{:else}
					<ul id="search-results" role="listbox" bind:this={list}>
						{#each results as item, i (item.ratingKey)}
							{@const thumb = item.type === 'episode' ? (item.grandparentThumb ?? item.thumb) : item.thumb}
							<li role="option" id="search-opt-{i}" aria-selected={i === active} data-index={i}>
								<a
									href={hrefFor(item)}
									class:active={i === active}
									onpointerenter={() => (active = i)}
									onclick={(e) => {
										e.preventDefault();
										select(item);
									}}
								>
									<span class="thumb">
										{#if thumb}<img src={img(thumb, 48, 72)} alt="" loading="lazy" />{/if}
									</span>
									<span class="text">
										<strong>{displayTitle(item)}</strong>
										<span class="muted">{subtitle(item)}</span>
									</span>
									<span class="type">{TYPE_LABEL[item.type] ?? item.type}</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 10vh 16px 16px;
	}
	.scrim {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgb(3 7 15 / 0.72);
		backdrop-filter: blur(6px);
		cursor: default;
	}
	.panel {
		position: relative;
		width: min(680px, 100%);
		max-height: 75vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow:
			var(--shadow),
			0 0 0 1px rgb(125 211 252 / 0.08),
			0 0 60px rgb(56 189 248 / 0.12);
		overflow: hidden;
	}
	.box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 0.75rem 0 1.1rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.2rem;
		color: var(--accent);
	}
	.box input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		padding: 1.05rem 0;
		font-size: 1.1rem;
		box-shadow: none;
		color: var(--text);
	}
	.box input::-webkit-search-cancel-button {
		display: none;
	}
	.close {
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		color: var(--text-dim);
	}
	.close:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.close :global(.x) {
		display: none;
	}
	.body {
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.hint {
		margin: 0;
		padding: 2rem 1.25rem;
		text-align: center;
		line-height: 1.8;
	}
	.keys {
		display: block;
		font-size: 0.85rem;
	}
	kbd {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--surface);
		color: var(--text);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0.4rem;
	}
	a {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
	}
	a.active {
		background: var(--surface);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.thumb {
		flex: none;
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
	.text {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.1rem;
	}
	.text strong,
	.text span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.text span {
		font-size: 0.85rem;
	}
	.type {
		flex: none;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.15rem 0.4rem;
	}
	a.active .type {
		color: var(--accent);
		border-color: var(--accent);
	}

	/* Phones: full-screen sheet instead of a floating panel. */
	@media (max-width: 640px) {
		.overlay {
			padding: 0;
		}
		.panel {
			width: 100%;
			height: 100%;
			max-height: none;
			border: 0;
			border-radius: 0;
			padding-top: env(safe-area-inset-top);
			padding-bottom: env(safe-area-inset-bottom);
		}
		.close {
			border: 0;
			background: none;
			font-size: 1.3rem;
			padding: 0.4rem;
		}
		.close .esc,
		.keys {
			display: none;
		}
		.close :global(.x) {
			display: block;
		}
	}
</style>
