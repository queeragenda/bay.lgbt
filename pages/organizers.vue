<script setup>
const { data } = await useFetch(`/api/organizers`);
</script>

<template>
  <OldSchoolWindow title="Organizers" v-if="data">
    <ul>
      <li v-for="organizer in  data " :key="organizer.id">
        <NuxtLink :to="{ name: 'o-organizer', params: { organizer: organizer.sourceName } }">{{ organizer.sourceName }}
        </NuxtLink>
      </li>
    </ul>
  </OldSchoolWindow>
</template>
