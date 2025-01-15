<script setup lang="ts">

definePageMeta({
  validate: async (route) => {
    return route.params.organizer_type === 'i' || route.params.organizer_type === 'e';
  }
})

const route = useRoute();
// useHead({
// title: route.params.organizer
// });
//
const { data } = await useFetch(`/api/events/${route.params.organizer_type}/${route.params.event_id}`);
</script>

<template>
  <SingleEvent v-if="data?.body" :event="data.body" />
</template>
