<!-- OldSchoolButton is a wrapper around NuxtLink that looks like a 90s UI button -->
<script setup lang="ts">
import './OldSchoolButton.css'

defineProps<{
  to: any
}>()
</script>

<template>
  <NuxtLink :to="$props.to" class="OldSchoolButton">
    <button type="button">
      <slot></slot>
    </button>
  </NuxtLink>
</template>
