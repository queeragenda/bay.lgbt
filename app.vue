<script setup lang="ts">
import { AppConfigInput } from '@nuxt/schema'

const app = useAppConfig() as AppConfigInput
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - bay.lgbt` : 'bay.lgbt';
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    {
      hid: 'description',
      name: 'bay.lgbt',
      content: '',
    },
  ],
  link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  script: [
    {
      src: 'https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=default%2Ces2015%2Ces6%2Ces5',
      crossorigin: 'anonymous',
    },
    {
      src: '//baywatch.lilys.hair/count.js',
      async: true,
      'data-goatcounter': 'https://baywatch.lilys.hair/count',
    },
  ],
})
</script>

<template>
  <NuxtPage />
</template>
