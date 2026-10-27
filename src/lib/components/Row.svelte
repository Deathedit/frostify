<script lang="ts">
	import type { Metadata } from '#lib/plex/types.js';
	import Icon from './Icon.svelte';
	import PosterCard from './PosterCard.svelte';

	let {
		title,
		items,
		variant = 'poster'
	}: { title: string; items: Metadata[]; variant?: 'poster' | 'landscape' } = $props();

	let scroller: HTMLDivElement;
	let atStart = $state(true);
	let atEnd = $state(false);

	function update() {
		atStart = scroller.scrollLeft < 8;
		atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 8;
	}

	function page(dir: 1 | -1) {
		scroller.scrollBy({ left: dir * scroller.clientWidth * 0.85, behavior: 'smooth' });
	}

	$effect(() => {
		void items;
		update();
	});
</script>

<section class="row">
	<h2>{title}</h2>
	<div class="viewport">
		<button class="nav prev" class:hidden={atStart} aria-label="Scroll left" onclick={() => page(-1)}>
			<Icon name="chevronLeft" />
		</button>
		<div class="scroller" bind:this={scroller} onscroll={update}>
			{#each items as item (item.ratingKey)}
				<PosterCard {item} {variant} />
			{/each}
		</div>
		<button class="nav next" class:hidden={atEnd} aria-label="Scroll right" onclick={() => page(1)}>
			<Icon name="chevronRight" />
		</button>
	</div>
</section>

<style>
	.row {
		margin-top: 1.5rem;
	}
	h2 {
		margin: 0 var(--gutter) -0.25rem;
		font-size: clamp(1rem, 1.6vw, 1.3rem);
		font-weight: 700;
	}
	.viewport {
		position: relative;
	}
	.scroller {
		display: flex;
		gap: 0.6rem;
		overflow-x: auto;
		/* room for hover scale + glow, which overflow would otherwise clip */
		padding: 1.4rem var(--gutter);
		scroll-padding-inline: var(--gutter);
		scroll-snap-type: x proximity;
		scrollbar-width: none;
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.nav {
		position: absolute;
		top: 1.4rem;
		bottom: 1.4rem;
		z-index: 5;
		width: calc(var(--gutter) - 4px);
		min-width: 36px;
		border: 0;
		background: rgb(7 13 26 / 0.6);
		font-size: 1.8rem;
		display: grid;
		place-items: center;
		opacity: 0;
		transition:
			opacity 0.2s,
			background 0.2s;
	}
	.prev {
		left: 0;
		border-radius: 0 var(--radius) var(--radius) 0;
	}
	.next {
		right: 0;
		border-radius: var(--radius) 0 0 var(--radius);
	}
	.viewport:hover .nav:not(.hidden),
	.nav:focus-visible:not(.hidden) {
		opacity: 1;
	}
	.nav:hover {
		background: rgb(7 13 26 / 0.85);
		color: var(--accent);
	}
	.nav.hidden {
		pointer-events: none;
	}
	@media (max-width: 640px) {
		.row {
			margin-top: 0.75rem;
		}
		.scroller {
			gap: 0.5rem;
			padding-block: 0.8rem;
		}
	}
	@media (hover: none) {
		.nav {
			display: none;
		}
	}
</style>
