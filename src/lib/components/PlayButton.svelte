<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolvePlayable } from '#lib/plex/library.js';
	import type { Metadata } from '#lib/plex/types.js';
	import Icon from './Icon.svelte';

	let { item, label }: { item: Metadata; label?: string } = $props();
	let busy = $state(false);

	const text = $derived(label ?? (item.viewOffset ? 'Resume' : 'Play'));

	async function play() {
		busy = true;
		try {
			await goto(`/watch/${await resolvePlayable(item)}`);
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not start playback');
		} finally {
			busy = false;
		}
	}
</script>

<button class="btn btn-primary" onclick={play} disabled={busy}>
	<Icon name="play" />
	{text}
</button>
