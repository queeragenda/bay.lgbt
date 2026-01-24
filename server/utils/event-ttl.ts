import { Duration } from "luxon";

export function parseUnseenEventTtl(source: { name: string, unseen_event_ttl?: string }): Duration | undefined {
	if (!source.unseen_event_ttl) {
		return;
	}

	return Duration.fromISO(source.unseen_event_ttl);
}
