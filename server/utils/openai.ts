import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { InstagramApiPost } from '~/types';
import { logger } from './logger';
import { InstagramSource } from './sources/instagram';

const openai = new OpenAI();

const OpenAiInstagramEvent = z.object({
	title: z.string(),
	start: z.string().datetime(),
	end: z.string().datetime(),
	hasStartHourInPost: z.boolean(),
});

const OpenAiInstagramResult = z.object({
	event: OpenAiInstagramEvent.nullable(),
});

export type OpenAiInstagramResult = z.infer<typeof OpenAiInstagramResult>;
export type OpenAiInstagramEvent = z.infer<typeof OpenAiInstagramEvent>;

export async function extractInstagramEvent(
	source: InstagramSource,
	post: InstagramApiPost,
	ocrResults: string[],
): Promise<OpenAiInstagramResult | null> {
	const response = await openai.responses.parse({
		model: 'gpt-6-luna',
		input: [
			{
				role: 'developer',
				content: `
You are evaluating posts from an instagram account to extract information about events that may be advertised in the post. Each post is comprised of caption data, and the OCR-extracted text from one or more image files. Information on the events will be spread across the caption, image, tags, the account that made the post, and the time at which the post was made. Use all of this information to determine the event information. It is possible that a post is not about an event at all, in which case you should set the 'event' output property to null.

Guidelines to follow when evaluating post data:

- Information regarding time provided by the caption is guaranteed to be correct, and should take priority over the image data. However, the caption might be lacking information regarding time and title.
- You may need to combine data from the caption and the image file in order to assemble a complete version of the event data.
- Sometimes a person or artist's username and their actual name can be found in the caption and image; the username can be indicated by it being all lowercase and containing '.'s or '_'s. Their actual names would have very similar letters to the username, and might be provided by the image. If the actual name is found, prefer using it for the JSON title, otherwise use the username.

- Assume that all times in the caption and image data are in the America/Los_Angeles time zone. You MUST convert these times to UTC when giving your result. The post timestap is in UTC.
- The time the post was posted itself is not an event start time. However, if the post is about an event, the post time can be used to extrapolate event times relative to today, time-relative wording is used; for example, if the event starts 'tomorrow', you can determine that the event begins 1 day after the posts's date.
- If no start date/time is explicitly provided by the caption or image, and it cannot be inferred using relative times, do not make one up.
- If no end time is explicitly provided by the caption or image, and it cannot be inferred using relative times, assume the event lasts 3 hours.
- If no start hour is explicitly provided by the caption or image, such as ('2 pm' or the '9' in '9-12'), you MUST NOT make up a time.
- If it's an event, use any written relative time descriptors (such as 'night') to determine whether the event starts and/or ends in the AM or PM.
- If the end hour is less than the start hour (for example, 9 to 2), assume the event ends on the day after the starting day.
- If the end time states 'late' or similar, assume it ends at 2 AM on the day after 'start'.
- If the end time states 'morning' or similar, assume it ends at 6 AM on the next day from 'start'.
- If no years are explicity provided, assume the dates are in whatever year is closest to today's date.
- If the start hour is PM and the end hour is AM, assume the event ends on the next day from the starting day.
- Don't make any timezone-related adjustments to the times; assume it is UTC already.

- Don't add any extra capitalization or spacing to the title that wasn't included in the post's information.
- If the title of the event is longer than 210 characters, shorten it to include just the most important parts.

- If post contains multiple different events, only output the result for the earliest event.
- If the event is explicity 'private', or a 'meeting', then set the start hour to null.

- If the event includes music artist names, separate them with '&' and include them in 'title'

- Consider that emoji may represent numbers when evaluating the time, for example 🎱 could be read as '8'.
				`,
			},
			{
				role: 'user',
				content: `
data for instagram post

account: ${source.username}

account tags: ${source.contextClues.join(' ')}

time: ${post.timestamp}

caption: ${post.caption || ''}

ocr data: ${ocrResults.join('\n')}
							`,
			},
		],
		text: {
			format: zodTextFormat(OpenAiInstagramResult, 'event'),
		},
	});

	return response.output_parsed;
}
