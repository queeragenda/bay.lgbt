<!-- OldSchoolWindow is a generic component that makes its content look (ish) like a Windows 9x window -->
<script setup lang="ts">
defineProps<{
  href: string
}>()
</script>

<template>
  <a :href="$props.href" class="OldSchoolButton">
    <button type="button">
      <slot></slot>
    </button>
  </a>
</template>
