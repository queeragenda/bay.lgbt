<script setup lang="ts">
import { ApiEvent } from '~~/types';

const route = useRoute();
const { data } = await useFetch<{ body: ApiEvent }>(`/api/events/${route.params.event_id}`);

let moreEvents;
if (data?.value?.body) {
  const { data: moreEventsData } = await useFetch(`/api/list-events?organizerId=${data.value.body.extendedProps.organizerId}`);
  moreEvents = moreEventsData;

  const event = data.value.body;
  useHead({
    title: event.title,
  });

  const start = new Date(event.start);
  const restDescription = event.extendedProps.description ? ` // ${event.extendedProps.description}` : '';
  const image = event.extendedProps.images ? event.extendedProps.images[0] : null;

  useSeoMeta({
    ogTitle: event.title,
    ogDescription: `${start.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })} @ ${start.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })}${restDescription}`,
    ogImage: image,
  });
}

let moreEventsFiltered;
if (moreEvents?.value?.body) {
  moreEventsFiltered = moreEvents.value.body[0].events.map(e => ({
    ...e,
    start: new Date(e.start),
  })).filter(e => e.start > new Date());
}

</script>

<template>
  <div class="EventPage">
    <SingleEvent v-if="data?.body" :event="data.body" />
    <!-- <OldSchoolWindow v-if="data?.body" :title="`More from ${data.body.extendedProps.organizer}`">

      <ul v-if="moreEvents.body">
        <li v-for="( event, index ) in moreEventsFiltered" :key="index">
          {{ event.start.toLocaleString() }} -
          <NuxtLink :to="event.url">{{ event.title }}</NuxtLink>
        </li>
      </ul>
      <div v-else>
        loading...
      </div>
    </OldSchoolWindow> -->
  </div>
</template>
