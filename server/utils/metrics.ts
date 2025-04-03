import { Counter, Gauge, Histogram } from "prom-client";

export const scrapeStartCount = new Counter({
	name: 'scrape_start_count',
	help: 'number of times we started a scrape for a particular source',
	labelNames: ['source_type', 'source_name'],
});

export const scrapeCompleteCount = new Counter({
	name: 'scrape_complete_count',
	help: 'number of times we completed a scrape by source, along with the result (ok/error) of that scrape',
	labelNames: ['source_type', 'source_name', 'result'],
});

export const scrapeTime = new Histogram({
	name: 'scrape_duration',
	help: 'duration of scrape by source',
	labelNames: ['source_type', 'source_name'],
});

export const eventsSaved = new Counter({
	name: 'events_saved_count',
	help: 'number of events saved by source',
	labelNames: ['source_type', 'source_name'],
});

export const imagesSaved = new Counter({
	name: 'images_saved_count',
	help: 'number of images saved by source',
	labelNames: ['source_type', 'source_name'],
});

export const instagramRateLimitErrors = new Counter({
	name: 'instagram_rate_limit_errors_count',
	help: 'number of times instagram rate limited us',
});

export const instagramRateLimitHeader = new Gauge({
	name: 'instagram_rate_limit_header',
	help: 'contents of the instagram rate limit headers (we get limited when any get to 100)',
	labelNames: ['header'],
});

export const instagramTokenExpireAt = new Gauge({
	name: 'instagram_token_expire_at',
	help: 'timestamp (s since epoch) the currently used instagram token will expire',
});
