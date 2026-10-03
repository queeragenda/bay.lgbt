<script setup lang="ts">
const route = useRoute();
const { data } = await useFetch(`/api/organizer/${route.params.organizer_id}`);

let slug: string;
if (typeof route.params.organizer_slug === 'string') {
	slug = route.params.organizer_slug;
} else  {
	slug = route.params.organizer_slug[0];
}

let title: string = slug;
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
