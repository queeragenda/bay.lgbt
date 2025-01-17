<!-- OldSchoolWindow is a generic component that makes its content look (ish) like a Windows 9x window -->
<script setup lang="ts">
import './OldSchoolWindow.css';

defineProps<{
  title: string
}>()
</script>

<template>
  <div class="OldSchoolWindow">
    <div class="OldSchoolWindow-header">
      <h2>{{ title }}</h2>
    </div>

    <div class="OldSchoolWindow-bodyWrapper">
      <div class="OldSchoolWindow-body">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
