<script lang="ts" module>
	const paths = {
		play: 'M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z',
		pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
		info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z',
		search: 'M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z',
		back: 'M15.4 4.6 14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12l7.4-7.4Z',
		chevronLeft: 'M15.4 4.6 14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12l7.4-7.4Z',
		chevronRight: 'M8.6 19.4 10 20.8l8.8-8.8L10 3.2 8.6 4.6 16 12l-7.4 7.4Z',
		chevronDown: 'M4.6 8.6 3.2 10l8.8 8.8 8.8-8.8-1.4-1.4L12 16 4.6 8.6Z',
		rewind: 'M12.5 3a9 9 0 1 1-8.95 10h2.02A7 7 0 1 0 12.5 5V8L8 4l4.5-4v3Z',
		forward: 'M11.5 3a9 9 0 1 0 8.95 10h-2.02A7 7 0 1 1 11.5 5V8L16 4l-4.5-4v3Z',
		volume: 'M4 9v6h4l5 5V4L8 9H4Zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.06a7 7 0 0 1 0 13.48v2.06a9 9 0 0 0 0-17.6Z',
		mute: 'M4 9v6h4l5 5V4L8 9H4Zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7Z',
		fullscreen: 'M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 4v-4h2v6h-6v-2h4Z',
		exitFullscreen: 'M8 4h2v6H4V8h4V4Zm6 0h2v4h4v2h-6V4ZM4 14h6v6H8v-4H4v-2Zm10 0h6v2h-4v4h-2v-6Z',
		settings: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L14.9 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.4 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.9h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13ZM12.9 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
		next: 'M5 4.5v15l11-7.5L5 4.5ZM17 4h2v16h-2z',
		check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
		close: 'M18.3 5.7 16.9 4.3 12 9.2 7.1 4.3 5.7 5.7 10.6 10.6l-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z',
		home: 'M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z',
		tv: 'M3 5h18v12H3V5Zm2 2v8h14V7H5Zm3 12h8v2H8v-2Z',
		film: 'M3 4h18v16H3V4Zm5 2v12h8V6H8ZM4.5 6.5v2h2v-2h-2Zm0 4.5v2h2v-2h-2Zm0 4.5v2h2v-2h-2Zm13-9v2h2v-2h-2Zm0 4.5v2h2v-2h-2Zm0 4.5v2h2v-2h-2Z',
		star: 'M12 17.3 18.2 21l-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7L12 17.3Z'
	} as const;
	export type IconName = keyof typeof paths;
</script>

<script lang="ts">
	let { name, class: className = '' }: { name: IconName; class?: string } = $props();
</script>

<svg class="icon {className}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
	<path d={paths[name]} />
</svg>
