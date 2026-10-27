<script lang="ts">
	let { size = 48, label = 'Loading' }: { size?: number; label?: string } = $props();
</script>

<div class="spinner" style:width="{size}px" style:height="{size}px" role="status" aria-label={label}></div>

<style>
	.spinner {
		border-radius: 50%;
		border: 3px solid rgb(125 211 252 / 0.15);
		border-top-color: var(--accent);
		animation: spin 0.8s linear infinite;
		filter: drop-shadow(0 0 6px rgb(125 211 252 / 0.5));
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
