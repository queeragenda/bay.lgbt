<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/organizer/${route.params.organizer_id}`);

let title = route.params.organizer_slug;
if (data?.value) {
  title = data.value.name;
}

useHead({
  title,
});
</script>

<template>
  <BayLgbtCalendar v-if="data" :organizer="data" />
  <p v-else>loading...</p>
</template>
