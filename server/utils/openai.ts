import { OpenAIApi } from "openai";
import { InstagramApiPost } from "~/types";
import { logger } from "./logger";
import { InstagramSource } from "./sources/instagram";

export interface OpenAiInstagramResult {
	isEvent: boolean;
	title: string | null;
	startDay: number | null;
	endDay: number | null;
	isPastEvent: boolean;
	hasStartHourInPost: boolean;
	startHourMilitaryTime: number | null;
	endHourMilitaryTime: number | null;
	startMinute: number | null;
	endMinute: number | null;
	startMonth: number | null;
	endMonth: number | null;
	startYear: number | null;
	endYear: number | null;
}

export function instagramInitialPrompt(source: InstagramSource, post: InstagramApiPost, ocrResult: string | null): string {
	const caption = post.caption || '';
	const tags = source.contextClues.join(' ');
	ocrResult = ocrResult ? ocrResult.substring(0, 2200) : '';

	return `You're given a post from an Instagram account${tags.length > 0 ? ' related to ' + tags : ''}. Your task is to parse event information and output it into JSON. (Note: it's possible that the post isn't event-related).\n` +
		"Here's the caption provided by the post:\n" +
		"```\n" +
		`${caption}` + "\n" +
		"```\n" +
		"\n" +
		"Here's the result of an OCR AI that reads text from the post's image:\n" +
		"```\n" +
		`${ocrResult ? "OCR Result: " + ocrResult : ''}` + "\n" +
		"```\n" +
		"\n" +
		"Output the results in the following JSON format: \n" +
		"```\n" +
		`{\n` +
		`"isEvent": boolean,\n` +
		`"title": string | null,\n` +
		`"startDay": number | null,\n` +
		`"endDay": number | null,\n` +
		// Putting `isPastEvent` and `startHourMilitaryTime` knocks some sense into the model into not imagining start times.
		`"isPastEvent": boolean,\n` +
		`"hasStartHourInPost": boolean,\n` +
		`"startHourMilitaryTime": number | null,\n` +
		`"endHourMilitaryTime": number | null,\n` +
		`"startMinute": number | null,\n` +
		`"endMinute": number | null,\n` +
		`"startMonth": number | null,\n` +
		`"endMonth": number | null,\n` +
		`"startYear": number | null,\n` +
		`"endYear": number | null,\n` +
		` }\n` +
		"```\n" +
		// "Here's some important information regarding the post information:\n" +
		"Guidelines to follow when creating the JSON:\n" +
		"- Information regarding time provided by the caption is guaranteed to be correct. However, the caption might be lacking information regarding time and title.\n" +
		"- The OCR result is provided by an OCR AI & thus may contain errors. Use it as a supplement for the information provided in the caption! This is especially useful when the caption is lacking information. The OCR Result also may contain time or title information that's not provided by the caption!\n" +
		"- Sometimes a person or artist's username and their actual name can be found in the caption and OCR result; the username can be indicated by it being all lowercase and containing `.`s or `_`s. Their actual names would have very similar letters to the username, and might be provided by the OCR result. If the actual name is found, prefer using it for the JSON title, otherwise use the username.\n" +
		// "Here are some additional rules you should follow:\n" +
		`- The post was posted on ${post.timestamp}. The time it was posted itself is not an event start time. However, if the post is about an event, the post time can be used to extrapolate event times relative to today, time-relative wording is used; for example, if the event starts 'tomorrow', you can determine that the event begins 1 day after today's date.\n` +
		"- If no start day is explicitly provided by the caption or OCR result, and it cannot be inferred using relative times, assign `startDay` to `null`.\n" +
		"- If no end day is explicitly provided by the caption or OCR result, assign `endDay` to `null`.\n" +
		// "-If only one time is provided in the caption or OCR result, assume it's the start time.\n" +
		"- If no start hour is explicitly provided by the caption or OCR result, such as ('2 pm' or the '9' in '9-12'), you MUST assign `startHourMilitaryTime` to `null`, even if the post is about an event.\n" +
		"- If no end hour is explicitly provided by the caption or OCR result, assign `endHourMilitaryTime` to `null`.\n" +
		"- If it's an event, use any written relative time descriptors (such as 'night') to determine whether the event starts and/or ends in the AM or PM.\n" +
		// "-If the end hour is less than the start hour (for example, 9 to 2), assume the event ends on the day after the starting day.\n" +
		"- If no start minute is explicitly provided by the caption or OCR result, assign `startMinute` to `null`.\n" +
		"- If no end minute is explicitly provided by the caption or OCR result, assign `endMinute` to `null`.\n" +
		"- If the end time states 'late' or similar, assume it ends around 2 AM on the next day from `startDay`.\n" +
		"- If the end time states 'morning' or similar, assume it ends around 6 AM on the next day from `startDay`.\n" +
		"- If no end month is explicitly provided by the caption or OCR result, assign it to the same month as startMonth.\n" +
		`- If no start or end year are explicity provided, assume they are both the current year of ${new Date().getFullYear()}.\n` +
		"- If the start hour is PM and the end hour is AM, assume the event ends on the next day from the starting day.\n" +
		"- If the event happened already, indicated by past-tense language like 'last Sunday', then set `isPastEvent` to false.\n" +
		// Do this to prevent it from making adjustments to the time.
		"- Don't make any timezone-related adjustments to the times; assume it is UTC already.\n" +
		"- Don't add any extra capitalization or spacing to the title that wasn't included in the post's information.\n" +
		"- If the title of the event is longer than 210 characters, shorten it to include just the most important parts.\n" +
		// The following is to avoid organizer meetings.
		"- If post contains multiple different events, only output the result for the earliest event.\n" +
		"- If the event is explicity 'private', or a 'meeting', then set the start hour to null.\n" +
		`${tags.toLowerCase().includes('music') ? "- Add \`&\` in between multiple music artist names, if any exist.\n" : ""}` +
		`${tags.toLowerCase().includes('music') ? "- Include featured music artists in the title as well.\n" : ""}` +
		`${(caption.includes('🎱') || ocrResult.includes('🎱')) ? "- Consider 🎱 to be read as `8` if given as a time. \n" : ""}` +
		"- Do not include any other text in your response besides the raw JSON." + "\n" +
		'- Make sure JSON format is valid (i.e. contains commas after each field, except for the last one).' + "\n" +
		"\n" +
		"A:";
}


export function instagramRepairPrompt(modelOutputJson: string, post: InstagramApiPost, ocrResult: string | null): string {
	return `You were given a post from an Instagram account and used it to generate the following JSON:\n` +
		"```\n" +
		`${modelOutputJson}` + "\n" +
		"```\n" +
		"\n" +
		"The post's caption is as follows:\n" +
		"```\n" +
		`${post.caption}` + "\n" +
		"```\n" +
		"\n" +
		"The post's OCR result is as follows:\n" +
		"```\n" +
		`${ocrResult ? "OCR Result: " + ocrResult : ''}` + "\n" +
		"```\n" +
		"\n" +
		"Your job is to fix potential incorrect values for `hasStartHourInPost` in the generated JSON's values with respect to the post's information (via caption & OCR result), and output a corrected JSON. In particular, set `hasStartHourInPost` to false if the post's information doesn't contain any identifiable hour information or hour-conveying time-of-day information, disregarding whether it has a starting date. Conversely, set it to true if it does contain hour information." +
		"Don't edit any other fields besides `hasStartHourInPost`. Make sure to not change the structure of the JSON. Only output the raw JSON (in a valid format), without saying anything else. Here are some examples to help guide you." + "\n" +
		"\n" +
		`Input: The post's caption and OCR don't contain any hour-conveying info.` + "\n" +
		`Output: The JSON with "hasStartHourInPost" set to \`false\`.` + "\n" +
		"\n" +
		`Input: The post's caption and/or OCR contains "1 to 3 PM."` + "\n" +
		`Output: The JSON with "hasStartHourInPost" set to \`true\`.` + "\n" +
		"\n" +
		`Input: The post's caption and/or OCR contains just "night" or "tonight" for time-of-day.` + "\n" +
		`Output: The JSON with "hasStartHourInPost" set to \`false\` because "tonight" does not represent a specific hour.` + "\n" +
		"\n" +
		`Input: The post's OCR says "midnight"` + "\n" +
		`Output: The JSON with "hasStartHourInPost" set to \`true\` because "midnight" represents 12 AM.`;
}

export async function executePrompt(client: OpenAIApi, prompt: string) {
	try {
		const res = await client.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: [
				{ role: "system", content: prompt },
			],
			temperature: 0,
			max_tokens: 500,
		});
		return res.data;
	} catch (error: any) {
		logger.error({ error: error.toString() }, 'Error running gpt');
		throw error;
	}
};
