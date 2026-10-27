<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Player from '#lib/components/Player.svelte';

	const key = $derived(page.params.key ?? '');

	function exit() {
		if (history.length > 1) history.back();
		else goto(`/title/${key}`);
	}
</script>

<svelte:head><title>Watching · Frostify</title></svelte:head>

{#key key}
	<Player ratingKey={key} onexit={exit} />
{/key}
