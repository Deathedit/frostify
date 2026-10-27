// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Search overlay is open (shallow history entry, so Back closes it). */
			search?: boolean;
		}
		// interface Platform {}
	}
}

export {};
