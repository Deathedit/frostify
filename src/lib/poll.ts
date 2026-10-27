import { untrack } from 'svelte';

/**
 * Run `fn` now and then every `ms` while the tab is visible. Waits for each run to finish
 * before scheduling the next, so slow responses never pile up. Returns a stop function.
 * `fn` runs untracked, so calling poll() inside an $effect never makes the effect depend on
 * state that `fn` reads (which would restart polling on every response).
 */
export function poll(fn: () => unknown, ms: number): () => void {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const tick = async () => {
		if (stopped) return;
		if (document.visibilityState === 'visible') {
			try {
				await untrack(fn);
			} catch {
				// callers surface their own errors
			}
		}
		if (!stopped) timer = setTimeout(tick, ms);
	};
	tick();
	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}
