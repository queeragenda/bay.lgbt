<script setup lang="ts">
import { ModalsContainer } from 'vue-final-modal';
import 'assets/style.css';

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
});

useSeoMeta({
  ogTitle: 'bay.lgbt - your queer events destination!',
  ogDescription: 'bay.lgbt is a free and non-commercial site that lists queer events in the san francisco bay area',
});
</script>

<template>
  <ModalsContainer />
  <div class="page">
    <div class="page-header">
      <div class="title">
        <a href="/">bay.lgbt</a>
      </div>
      <div class="blurb">A communal board for LGBT events all around SF bay, updated 25/7!</div>
    </div>
    <NuxtPage />
    <div style="display: flex; align-items: center; flex-direction: row;">
      <div class="desc">
        <a href="/about">About Us</a> | <a
          href="https://raw.githubusercontent.com/ivyraine/bay.lgbt/main/server/utils/event_sources.json">event
          sources</a> |
        <a href="https://github.com/ivyraine/bay.lgbt/">source code</a>
      </div>
    </div>
  </div>
</template>
