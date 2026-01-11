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
  events: {},
  year_month: String,
});

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
    onConfirm() {
      closeFilterModal();
      // This is required bc all of this stuff isn't "reactive".
      calendarOptions.value.events = url();
    },
  },
});

const cityEnablement = useCityEnablement();

const url = () => {
  let urlParams: any = {};

  if (props.organizer && props.organizer.id) {
    urlParams.organizerId = props.organizer.id;
  }

  urlParams.cities = Object.keys(cityEnablement.value).filter(cityID => cityEnablement.value[cityID]);

  return '/api/events/list?' + new URLSearchParams(urlParams).toString();
};


const calendarOptions: Ref<CalendarOptions> = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
  initialView: getWindowWidth() <= 600 ? 'listMonth' : 'dayGridMonth',
  customButtons: {
    filter: {
      text: 'filter',
      click: openFilterModal,
    },
  },
  initialDate: props.year_month ? `${props.year_month}-01` : undefined,
  events: url(),
  headerToolbar: {
    left: 'prev today,filter',
    center: 'title',
    right: 'dayGridMonth,listMonth next'
  },
  titleFormat: (info) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
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
  progressiveEventRendering: true, // More re-renders; not batched. Needs further testing.
  stickyHeaderDates: true,
  dayHeaderDidMount: (args) => {
	  if (args.isToday) {
		  args.el.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
	    window.scrollTo(0, 0);
	  }
  },
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

onMounted(() => {
  window.addEventListener("resize", updateCalendarHeight);
});

onUpdated(() => {
});

onUnmounted(() => {
  if (process.client) window.removeEventListener('resize', updateWeekNumbers);
});
</script>

<template>
  <FullCalendar :options="calendarOptions" />
</template>
