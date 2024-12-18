interface EventNormalSource {
	events: Event[];
	city: string;
	display?: string;
}

// The Event object is based on https://fullcalendar.io/docs/event-object, as well as
interface Event {
	title: string | null;
	start: Date | null;
	end: Date | null;
	url: string;
	display?: string;
	backgroundColor?: string;
	borderColor?: string;
	textColor?: string;
	classNames?: string[];
	extendedProps?: Object;
}

interface EventGoogleCalendarSource {
	googleCalendarId: string;
}

export const eventDayDurationSplitThreshold = 3;
