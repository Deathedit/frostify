<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="page err">
	<h1>{page.status}</h1>
	<p class="muted">{page.error?.message ?? 'Something went wrong'}</p>
	<a class="btn btn-primary" href="/">Back home</a>
</div>

<style>
	.err {
		min-height: 80vh;
		display: grid;
		place-content: center;
		justify-items: center;
		text-align: center;
	}
	h1 {
		margin: 0;
		font-size: 5rem;
		color: var(--accent);
		text-shadow: var(--glow);
	}
</style>
