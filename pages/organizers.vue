<script setup>
const { data } = await useFetch(`/api/organizers`);
</script>

<template>
  <OldSchoolWindow title="Organizers" v-if="data">
    <ul>
      <li v-for="organizer in  data " :key="organizer.id">
        <NuxtLink
          :to="{ name: 'o-organizer_id-organizer_slug', params: { organizer_id: organizer.id, organizer_slug: organizer.slug } }">
          {{ organizer.name }}
        </NuxtLink>
      </li>
    </ul>
  </OldSchoolWindow>
</template>
