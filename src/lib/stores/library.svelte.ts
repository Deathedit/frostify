import { getSections } from '#lib/plex/library.js';
import type { Section } from '#lib/plex/types.js';

/** Library sections of the current server, loaded once per server. */
class Libraries {
	sections = $state<Section[]>([]);
	#loadedFor: string | null = null;

	async load(serverId: string) {
		if (this.#loadedFor === serverId) return;
		this.#loadedFor = serverId;
		try {
			this.sections = await getSections();
		} catch {
			this.#loadedFor = null;
			this.sections = [];
		}
	}

	reset() {
		this.#loadedFor = null;
		this.sections = [];
	}
}

export const libraries = new Libraries();
