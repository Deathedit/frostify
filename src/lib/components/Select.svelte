<script lang="ts" module>
	export interface SelectOption {
		value: string;
		label: string;
	}
	let nextId = 0;
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * Themed replacement for <select>: a button plus a listbox popover (select-only combobox
	 * pattern). Focus stays on the button; the active option is announced via aria-activedescendant.
	 */
	let {
		value = $bindable(),
		options,
		label,
		variant = 'box',
		onchange,
		class: className = ''
	}: {
		value: string | null | undefined;
		options: SelectOption[];
		/** accessible name, since there's no visible <label> wired to a native control */
		label: string;
		/** 'inline' renders as accent-coloured text with a caret, for use inside detail lists */
		variant?: 'box' | 'inline';
		/** called after the user picks a different value */
		onchange?: (value: string) => void;
		class?: string;
	} = $props();

	const id = `select-${nextId++}`;
	let open = $state(false);
	let active = $state(0);
	let dropUp = $state(false);
	let root: HTMLDivElement;
	let button: HTMLButtonElement;
	let list = $state<HTMLUListElement>();
	let typed = '';
	let typedTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedIndex = $derived(options.findIndex((o) => o.value === value));
	const current = $derived(options[selectedIndex]);

	async function show() {
		if (open || !options.length) return;
		active = Math.max(0, selectedIndex);
		// Open upwards when the list wouldn't fit below the button.
		const r = button.getBoundingClientRect();
		dropUp = innerHeight - r.bottom < Math.min(320, options.length * 40 + 16) && r.top > innerHeight - r.bottom;
		open = true;
		await tick();
		scrollActive();
	}

	function hide() {
		open = false;
	}

	function set(v: string) {
		if (v === value) return;
		value = v;
		onchange?.(v);
	}

	function choose(i: number) {
		const o = options[i];
		if (o) set(o.value);
		hide();
		button.focus();
	}

	function scrollActive() {
		list?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	}

	function move(to: number) {
		active = Math.min(options.length - 1, Math.max(0, to));
		tick().then(scrollActive);
	}

	// Type-ahead: jump to the next option starting with what was typed in the last 600 ms.
	function typeAhead(ch: string) {
		clearTimeout(typedTimer);
		typed += ch.toLowerCase();
		typedTimer = setTimeout(() => (typed = ''), 600);
		const start = typed.length === 1 ? active + 1 : active;
		for (let k = 0; k < options.length; k++) {
			const i = (start + k) % options.length;
			if (options[i].label.toLowerCase().startsWith(typed)) {
				if (open) move(i);
				else set(options[i].value);
				return;
			}
		}
	}

	function onKey(e: KeyboardEvent) {
		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
				e.preventDefault();
				show();
			} else if (e.key.length === 1 && /\S/.test(e.key)) {
				typeAhead(e.key);
			}
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
				move(active + 1);
				break;
			case 'ArrowUp':
				move(active - 1);
				break;
			case 'Home':
				move(0);
				break;
			case 'End':
				move(options.length - 1);
				break;
			case 'Enter':
			case ' ':
				choose(active);
				break;
			case 'Escape':
				hide();
				break;
			case 'Tab':
				hide();
				return;
			default:
				if (e.key.length === 1 && /\S/.test(e.key)) typeAhead(e.key);
				else return;
		}
		e.preventDefault();
		// Escape inside the player/search overlays shouldn't also close those.
		e.stopPropagation();
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		if (open && !root.contains(e.target as Node)) hide();
	}}
/>

<div class="select {className}" class:inline={variant === 'inline'} bind:this={root}>
	<button
		bind:this={button}
		type="button"
		class="trigger"
		class:open
		role="combobox"
		aria-label={label}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
		onclick={() => (open ? hide() : show())}
		onkeydown={onKey}
	>
		<span class="value">{current?.label ?? '—'}</span>
		<Icon name="chevronDown" class="chevron" />
	</button>

	{#if open}
		<ul id="{id}-list" class="list" class:up={dropUp} role="listbox" aria-label={label} bind:this={list}>
			{#each options as o, i (o.value)}
				<!-- svelte-ignore a11y_click_events_have_key_events (keyboard is handled on the combobox button, which keeps focus) -->
				<li
					id="{id}-opt-{i}"
					role="option"
					aria-selected={o.value === value}
					data-index={i}
					class:active={i === active}
					class:selected={o.value === value}
					onpointerenter={() => (active = i)}
					onclick={() => choose(i)}
				>
					<Icon name="check" class="tick" />
					<span>{o.label}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.select {
		position: relative;
		display: inline-block;
		min-width: 0;
	}
	.trigger {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		min-width: 9rem;
		padding: 0.55rem 0.7rem 0.55rem 0.9rem;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 8px;
		text-align: left;
		font-size: 0.95rem;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			background 0.15s;
	}
	.trigger:hover {
		background: var(--surface);
		border-color: var(--surface-hover);
	}
	.trigger:focus-visible,
	.trigger.open {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--glow);
	}
	.value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.trigger :global(.chevron) {
		flex: none;
		color: var(--text-dim);
		transition:
			transform 0.2s,
			color 0.15s;
	}
	.trigger.open :global(.chevron) {
		transform: rotate(180deg);
		color: var(--accent);
	}

	/* inline variant: reads as a link inside a details list */
	.inline .trigger {
		width: auto;
		min-width: 0;
		padding: 0.1rem 0.3rem;
		margin: -0.1rem -0.3rem;
		gap: 0.3rem;
		background: none;
		border-color: transparent;
		border-radius: 5px;
		color: var(--accent);
		font-size: inherit;
		font-weight: 500;
	}
	.inline .trigger:hover {
		background: rgb(125 211 252 / 0.08);
		border-color: transparent;
	}
	.inline .trigger:focus-visible,
	.inline .trigger.open {
		border-color: var(--accent);
		box-shadow: none;
	}
	.inline .trigger :global(.chevron) {
		color: var(--accent);
		width: 1em;
		height: 1em;
	}
	.inline .list {
		left: -0.3rem;
		right: auto;
	}

	.list {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 60;
		min-width: 100%;
		max-height: 320px;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow:
			var(--shadow),
			0 0 0 1px rgb(125 211 252 / 0.06);
		animation: drop 0.14s ease-out;
	}
	.list.up {
		top: auto;
		bottom: calc(100% + 6px);
		animation-name: rise;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem 0.5rem 0.55rem;
		border-radius: 6px;
		white-space: nowrap;
		cursor: pointer;
		font-size: 0.92rem;
	}
	li.active {
		background: var(--surface);
	}
	li.selected {
		color: var(--accent);
		font-weight: 600;
	}
	li :global(.tick) {
		flex: none;
		visibility: hidden;
		color: var(--accent);
	}
	li.selected :global(.tick) {
		visibility: visible;
	}
</style>
