<script setup lang="ts">
import { ApiEvent } from '~~/types';

definePageMeta({
  validate: async (route) => {
    return route.params.organizer_type === 'i' || route.params.organizer_type === 'e';
  }
})

const route = useRoute();
const { data } = await useFetch(`/api/events/${route.params.organizer_type}/${route.params.event_id}`, {
  async onResponse({ response }) {
    const event: ApiEvent = response._data.body;
    useHead({
      title: event.title,
    });

    const start = new Date(event.start);

    useSeoMeta({
      ogTitle: event.title,
      ogDescription: `${start.toLocaleDateString()} @ ${start.toLocaleTimeString()} // ${event.extendedProps.description}`,
    });
  }
});
</script>

<template>
  <SingleEvent v-if="data?.body" :event="data.body" />
</template>
