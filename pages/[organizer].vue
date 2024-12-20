<script setup lang="ts">
const route = useRoute();
useHead({
  title: route.params.organizer
});
</script>

<template>
  <BayLgbtCalendar :organizer="$route.params.organizer" />
</template>
