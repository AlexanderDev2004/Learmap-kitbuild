import { useEffect, useState } from "react";

/**
 * True once React has hydrated this component on the client. Server-rendered
 * pages include form submit handlers in markup only after hydration, so a
 * submit button pressed earlier falls through to a plain GET navigation.
 * Disable interactive buttons until this flips to avoid that dead submit.
 */
export function useHydrated(): boolean {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	return hydrated;
}
