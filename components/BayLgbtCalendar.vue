<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import $ from 'jquery';
import { DateTime } from 'luxon';

import FullCalendar from '@fullcalendar/vue3';
import { useModal } from 'vue-final-modal';
import FilterModal from './FilterModal.vue';
import { type CalendarOptions } from '@fullcalendar/core/index.js';

const props = defineProps({
  organizer: {},
});

interface County {
  enabled: any;
  cities: any;
}

// Note: cannot use LocalStorage due to SSR not having LocalStorage. Using LocalStorage would thus cause a hydration mismatch.
const isAllCitiesInMarinCountyEnabled = useIsAllCitiesInMarinCountyEnabled();
// SF-San Mateo County Cities.
const isSanFranciscoEnabled = useIsSanFranciscoEnabled();
const isOthersInSFSanMateoCountyEnabled = useIsOthersInSFSanMateoCountyEnabled();

// Alameda County Cities.
const isOaklandEnabled = useIsOaklandEnabled();
const isBerkeleyEnabled = useIsBerkeleyEnabled();
const isOthersInAlamedaCountyEnabled = useIsOthersInAlamedaCountyEnabled();

// Santa Clara County Cities.
const isSanJoseEnabled = useIsSanJoseEnabled();
const isSunnyvaleEnabled = useIsSunnyvaleEnabled();
const isOthersInSantaClaraCountyEnabled = useIsOthersInSantaClaraCountyEnabled();
// Santa Cruz County Cities.
const isSantaCruzEnabled = useIsSantaCruzEnabled();
const isOthersInSantaCruzCountyEnabled = useIsOthersInSantaCruzCountyEnabled();

const citiesToCounty = {
  [ALL_CITIES_IN_MARIN_COUNTY_ID]: MARIN_COUNTY_ID,
  [SAN_FRANCISCO_ID]: SF_SAN_MATEO_COUNTY_ID,
  [OTHERS_IN_SF_SAN_MATEO_COUNTY_ID]: SF_SAN_MATEO_COUNTY_ID,
  [OAKLAND_ID]: ALAMEDA_COUNTY_ID,
  [BERKELEY_ID]: ALAMEDA_COUNTY_ID,
  [OTHERS_IN_ALAMEDA_COUNTY_ID]: ALAMEDA_COUNTY_ID,
  [SAN_JOSE_ID]: SANTA_CLARA_COUNTY_ID,
  [SUNNYVALE_ID]: SANTA_CLARA_COUNTY_ID,
  [OTHERS_IN_SANTA_CLARA_COUNTY_ID]: SANTA_CLARA_COUNTY_ID,
  [SANTA_CRUZ_ID]: SANTA_CRUZ_COUNTY_ID,
  [OTHERS_IN_SANTA_CRUZ_COUNTY_ID]: SANTA_CRUZ_COUNTY_ID,
};

function isCity(city: string) {
  return Object.keys(citiesToCounty).includes(city);
}

function getCounty(city: string) {
  return citiesToCounty[city];
}

function isCounty(county: string) {
  return Object.keys(countiesToCities).includes(county);
}

const countiesToCities = {
  // Make an exception for Marin County: cluster all cities into one.
  [MARIN_COUNTY_ID]: {
    cities: {
      [ALL_CITIES_IN_MARIN_COUNTY_ID]: {
        enabled: isAllCitiesInMarinCountyEnabled,
      },
    }
  } as County,
  [SF_SAN_MATEO_COUNTY_ID]: {
    cities: {
      [SAN_FRANCISCO_ID]: {
        enabled: isSanFranciscoEnabled,
      },
      [OTHERS_IN_SF_SAN_MATEO_COUNTY_ID]: {
        enabled: isOthersInSFSanMateoCountyEnabled
      },
    }
  } as County,
  [ALAMEDA_COUNTY_ID]: {
    cities: {
      [OAKLAND_ID]: {
        enabled: isOaklandEnabled,
      },
      [BERKELEY_ID]: {
        enabled: isBerkeleyEnabled,
      },
      [OTHERS_IN_ALAMEDA_COUNTY_ID]: {
        enabled: isOthersInAlamedaCountyEnabled,
      },
    }
  } as County,
  [SANTA_CLARA_COUNTY_ID]: {
    cities: {
      [SAN_JOSE_ID]: {
        enabled: isSanJoseEnabled,
      },
      [SUNNYVALE_ID]: {
        enabled: isSunnyvaleEnabled,
      },
      [OTHERS_IN_SANTA_CLARA_COUNTY_ID]: {
        enabled: isOthersInSantaClaraCountyEnabled,
      },
    }
  } as County,
  [SANTA_CRUZ_COUNTY_ID]: {
    cities: {
      [SANTA_CRUZ_ID]: {
        enabled: isSantaCruzEnabled,
      },
      [OTHERS_IN_SANTA_CRUZ_COUNTY_ID]: {
        enabled: isOthersInSantaCruzCountyEnabled,
      },
    }
  } as County,
};

const getWindowHeight = () => {
  if (process.client) return window.innerHeight;
  return 600;
};

const getWindowWidth = () => {
  if (process.client) return window.innerWidth;
  return 350;
};

const calendarHeight = useCookie('calendarHeight', {
  sameSite: 'strict',
  default: () => 2000, maxAge: 60 * 60 * 24 * 365
});
if (process.client) calendarHeight.value = window.innerHeight;
const pageWidth = useCookie('pageWidth', {
  sameSite: 'strict',
  default: () => 1000, maxAge: 60 * 60 * 24 * 365
});
if (process.client) pageWidth.value = window.innerWidth;

const isUsingDayMaxEventRows = useState('isUsingDayMaxEventRows', () => true);

const updateWeekNumbers = () => {
  return getWindowWidth() < 350 ? false : true
};
// -1 indicates that there is no limit.
const updateDayMaxEventRows = () => { return isUsingDayMaxEventRows.value ? -1 : Math.floor(getWindowHeight() / 75) };

const { open: openFilterModal, close: closeFilterModal } = useModal({
  component: FilterModal,
  attrs: {
    title: 'County/City Filter',
    allCallback: updateAllIsEnabledSetting,
    countyCallback: updateCountyIsEnabledSetting,
    cityCallback: updateCityIsEnabledSetting,
    onConfirm() {
      closeFilterModal()
    },
  },
})

const calendarOptions: Ref<CalendarOptions> = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
  initialView: getWindowWidth() <= 600 ? 'listMonth' : 'dayGridMonth',
  customButtons: {
    less: {
      text: 'less',
      click: function () {
        isUsingDayMaxEventRows.value = !isUsingDayMaxEventRows.value;
        calendarOptions.value = {
          ...calendarOptions.value,
          dayMaxEventRows: updateDayMaxEventRows()
        };
      }
    },
    filter: {
      text: 'filter',
      click: openFilterModal,
    },
  },
  headerToolbar: {
    left: 'prev today,filter',
    center: 'title',
    right: 'dayGridMonth,listMonth next'
  },
  titleFormat: (info) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Sept', 'Oct', 'Nov', 'Dec'];
    const orgName = props.organizer ? ` - ${props.organizer.name}` : '';
    const title = `${months[info.date.month]} ${info.date.year}${orgName}`;

    if (info.date.month === 5) {
      return `🏳️‍🌈 ${title} 🏳️‍🌈`;
    }

    return title;
  },
  buttonText: {
    month: 'grid', // Feels clearar than 'month' and 'list'
    list: 'list'
  },
  nowIndicator: true,
  height: '100vh',
  dayMaxEventRows: updateDayMaxEventRows(),
  navLinks: true,
  weekNumbers: updateWeekNumbers(),
  eventSources: [],
  progressiveEventRendering: true, // More re-renders; not batched. Needs further testing.
  stickyHeaderDates: true,
  // Event handlers.
  // Move the scrollbar to today when the switching from other views.
  viewDidMount: moveListViewScrollbarToTodayAndColor,
  // eventDidMount: moveListViewScrollbarToTodayAndColor,
});

const updateCalendarHeight = () => {
  pageWidth.value = getWindowWidth();
  calendarHeight.value = getWindowHeight();
  calendarOptions.value = {
    ...calendarOptions.value,
    weekNumbers: getWindowWidth() < 350 ? false : true,
    dayMaxEventRows: updateDayMaxEventRows()
  };
};

function moveListViewScrollbarToTodayAndColor() {
  const listMonthViewScrollerClass = '.fc-scroller.fc-scroller-liquid';
  const dayGridMonthViewScrollerClass = '.fc-scroller.fc-scroller-liquid-absolute';

  const isInListMonthView = document.querySelector(listMonthViewScrollerClass) !== null;
  const isInDayGridMonthView = document.querySelector(dayGridMonthViewScrollerClass) !== null;

  const isInCurrentMonth = document.querySelector('.fc-list-day.fc-day.fc-day-today') !== null;

  if (isInListMonthView && isInCurrentMonth) {
    const today = document.querySelector('.fc-list-day.fc-day.fc-day-today');
    if (today.length <= 0) return;
    today?.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
    window.scrollTo(0, 0);
    // const todayY = today!.getBoundingClientRect().top;
    // const goToY = Math.min(todayY, todayY);
    // const listMonthViewScroller = document.querySelector(listMonthViewScrollerClass);
    // listMonthViewScroller!.scrollTop = goToY;

    // Old.
    // const today = '.fc-list-day.fc-day.fc-day-today';
    // const scrollLength = $('.fc-scroller.fc-scroller-liquid').prop("scrollHeight");
    // $('.fc-scroller.fc-scroller-liquid').scrollTop(Math.min($(today).position().top, scrollLength));

    // Change today element's --fc-neutral-bg-color to lightgreen.
    today!.style.setProperty('--fc-neutral-bg-color', 'lightgreen');
  }
  else if (isInDayGridMonthView) {
    const today = $('.fc-day.fc-day-today.fc-daygrid-day');
    if (today.length <= 0) return;
    const scrollLength = $('.fc-scroller.fc-scroller-liquid-absolute').prop("scrollHeight");
    $(dayGridMonthViewScrollerClass).scrollTop(Math.min($(today).position().top, scrollLength));
  }
}

async function getEventSources() {
  const route = useRoute();

  let endpoints = [`/api/list-events`];
  if (props.organizer) {
    endpoints = [`/api/list-events?organizerId=${props.organizer.id}`];
  }

  // TODO: figure out a real caching system
  // This is to preventing the UI changes from each fetch result to cause more fetches to occur.,
  Promise.allSettled(endpoints.map(async (endpoint) => {
    const { data: response } = await useFetch(endpoint);
    return addEventSources(transformEventSourcesResponse(response));
  }));
}

getEventSources();

// A hack to move the scrollbar to today after mounting- it is inconsistent otherwise on mobile.
if (process.client)
  setTimeout(moveListViewScrollbarToTodayAndColor, 0);

onMounted(() => {
  window.addEventListener("resize", updateCalendarHeight);
  moveListViewScrollbarToTodayAndColor();
});
onUpdated(() => {
});
onUnmounted(() => {
  if (process.client) window.removeEventListener('resize', updateWeekNumbers)
});

// Updates calendarOptions' eventSources and triggers a re-render of the calendar.
function addEventSources(newEventSources: EventNormalSource[] | EventGoogleCalendarSource[]) {
  // Cut out events without times, but typecheck for types that can have invalid times.
  newEventSources = newEventSources.map(eventSource => {
    // Skip events that can't be invalid.
    if (eventSource.events === undefined) return eventSource;

    // Filter events.
    const updatedEvents = new Array();
    eventSource.events.forEach((event) => {
      /* REMOVED TEMPORARILY, replaced with the hack below: Remove events that last longer than 3 days.
      Note: This also tends to cut out Eventbrite events that have 'Multiple Dates' over a range of 3 days.
      Using the official Eventbrite API would allow us to avoid this issue, but would potentially run into
      rate limits pretty quickly during peak hours. */
      const lengthInDays = Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 3600 * 24));

      if (lengthInDays <= eventDayDurationSplitThreshold) {
        updatedEvents.push(event);
      }
      else {
        // Split the event into multiple day-long events.
        // for (let i = 0; i < lengthInDays; i++) {
        // Temporarily just split into the first day and last day. TODO: Change this to split into individual days.
        for (let i = 0; i < lengthInDays; i += lengthInDays - 1) {

          let currentDayStart = DateTime.fromJSDate(event.start, { zone: 'utc' });
          // Set currentDayEnd to start's day, but end's hour and minute.
          let currentDayEnd = DateTime.fromJSDate(event.end, { zone: 'utc' }).set({ month: currentDayStart.month, day: currentDayStart.day }).plus({ days: i });
          currentDayStart = currentDayStart.plus({ days: i });

          // console.log(currentDayStart.toUTC().toISO(), currentDayEnd.toUTC().toISO());
          // // Adjust for end time being before start time.
          if (currentDayEnd < currentDayStart) {
            currentDayEnd.plus({ days: 1 });
          }

          // If set to all-day, set start to 0 and end to 23:59 in America/Los_Angeles time, to correct inaccurate times.
          if (event.allDay) {
            currentDayStart = currentDayStart.setZone('America/Los_Angeles').set({ hour: 0, minute: 0 }).toUTC();
            currentDayEnd = currentDayEnd.setZone('America/Los_Angeles').set({ hour: 23, minute: 59 }).toUTC();
          }

          const newSplitEvent = {
            ...event,
            // allDay: false,
            // title: `${event.title} (Day (${i + 1}/${lengthInDays})`,
            title: `${event.title} (${i === lengthInDays ? 'Last' : 'First'} Day)`,
            start: currentDayStart.toJSDate(),
            // Use the end time's hour and minute.
            end: currentDayStart.toJSDate(),
          };
          updatedEvents.push(newSplitEvent);
        }
      }
    });

    return {
      ...eventSource,
      events: updatedEvents,
      // events: newEvents,
    } as EventNormalSource;
  });
  // Issue: might take a long time to actually update the calendar if the list of, for example, Eventbrite events/sources is large.

  const res = {
    ...calendarOptions.value,
    eventSources: calendarOptions.value.eventSources.concat(newEventSources)
  };
  calendarOptions.value = res;
  return res;
}

function isDisplayingBasedOnFilterSettings(city: string) {
  if (isCity(city)) {
    const county = getCounty(city);
    return countiesToCities[county].cities[city].enabled.value ? 'auto' : 'none';
  }
  console.error(citiesToCounty[city], `Err: Invalid area name "${city} "chosen! You should only provide city names to event sources.`)
  return 'auto';
}

const transformEventSourcesResponse = (eventSources) => {
  const eventsSourcesWithoutProxy = toRaw(eventSources.value.body)
  if (!eventsSourcesWithoutProxy || eventsSourcesWithoutProxy.length < 1) return [];
  const datesAdded = eventsSourcesWithoutProxy.map(eventSource => {
    return {
      ...eventSource,
      // Set the `display` property, since the endpoints don't add it.
      display: isDisplayingBasedOnFilterSettings(eventSource.city),
      events: eventSource.events.map(event => {
        return {
          ...event,
          // Convert date strings to Date objects.
          start: new Date(event.start),
          end: new Date(event.end)
        }
      })
    }
  })
  return datesAdded;
}

function setCityIsEnabled(settingId, vueRef, value) {
  vueRef.value = value;
}

function updateAllIsEnabledSetting(newIsEnabled: boolean) {
  Object.keys(countiesToCities).forEach(county => {
    updateCountyIsEnabledSetting(newIsEnabled, county);
  });
  updateEventSourcesEnabled();
}

function updateCountyIsEnabledSetting(newIsEnabled: boolean, county: string) {
  Object.keys(countiesToCities[county].cities).forEach(cityId => {
    setCityIsEnabled(cityId, countiesToCities[county].cities[cityId].enabled, newIsEnabled);
  });
  updateEventSourcesEnabled();
}

// Re-calculates event sources w.r.t. whether should be displayed or not, and updates the calendarOptions (re-render).
// Warning: Might be expensive for only changing a single city.
function updateEventSourcesEnabled() {
  const newEventSources = calendarOptions.value.eventSources.map((source: EventNormalSource | EventGoogleCalendarSource) => {
    const isEnabled = countiesToCities[getCounty(source.city)].cities[source.city].enabled.value;
    return {
      ...source,
      // Updated filtered area.
      display: isEnabled ? 'auto' : 'none'
    } as EventSource;
  });
  calendarOptions.value = { ...calendarOptions.value, eventSources: newEventSources };
}

function updateCityIsEnabledSetting(newIsEnabled: boolean, cityId: string) {
  const isEnabledRef = countiesToCities[getCounty(cityId)].cities[cityId].enabled;
  setCityIsEnabled(cityId, isEnabledRef, newIsEnabled);
  updateEventSourcesEnabled();
}
</script>

<template>
  <FullCalendar :options='calendarOptions' />
</template>
