<script setup lang="ts">
import { ApiEvent } from '~~/types';

definePageMeta({
  validate: async (route) => {
    return route.params.organizer_type === 'i' || route.params.organizer_type === 'e';
  }
})

const route = useRoute();
const { data } = await useFetch<{ body: ApiEvent }>(`/api/events/${route.params.organizer_type}/${route.params.event_id}`);

if (data?.value?.body) {
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

</script>

<template>
  <SingleEvent v-if="data?.body" :event="data.body" />
</template>
