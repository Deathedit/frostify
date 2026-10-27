import { goto } from '$app/navigation';
import { page } from '$app/state';

/** Open the search overlay as a shallow history entry, so Back (or swipe back) closes it. */
export function openSearch() {
	if (!page.state.search) goto(location.href, { shallow: true, state: { search: true } });
}

export function closeSearch() {
	if (page.state.search) history.back();
}
