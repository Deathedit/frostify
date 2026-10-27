<script lang="ts">
	let { size = 1 }: { size?: number } = $props();
</script>

<span class="logo" style:font-size="{1.6 * size}rem">
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<g stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none">
			<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
			<path d="m9 4 3 3 3-3M9 20l3-3 3 3" />
		</g>
	</svg>
	FROSTIFY
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		font-weight: 800;
		letter-spacing: 0.08em;
		background: linear-gradient(120deg, #e0f7ff 0%, var(--accent) 45%, var(--accent-strong) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 0 12px rgb(125 211 252 / 0.35));
		line-height: 1;
	}
	svg {
		width: 0.9em;
		height: 0.9em;
		color: var(--accent);
	}
</style>
