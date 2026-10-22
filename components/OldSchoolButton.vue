<!-- OldSchoolButton is a wrapper around NuxtLink that looks like a 90s UI button -->
<script setup lang="ts">
import './OldSchoolButton.css'

defineProps<{
  to: any
  external?: boolean
}>()
</script>

<template>
  <NuxtLink :to="$props.to" :external="$props.external" class="OldSchoolButton">
    <button type="button">
      <slot></slot>
    </button>
  </NuxtLink>
</template>
