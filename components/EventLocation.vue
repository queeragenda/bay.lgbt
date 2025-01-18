<script setup>
const { location } = defineProps({
  location: {}
});

let locationString = '';
let locationSearch = '';
if (location?.eventVenue) {
  if (location.eventVenue.name) {
    const name = location.eventVenue.name.replace('&#39;', "'");

    locationString = name;
    locationSearch = name;
  }

  if (location.eventVenue.address?.streetAddress) {
    locationSearch += ` ${location.eventVenue.address.streetAddress}`;
  }
}

let locationLink = '';
if (locationSearch) {
  locationLink = `https://www.google.com/maps/search/${locationSearch}`;
}
</script>

<template>
  <NuxtLink v-if="locationLink" :to="locationLink" class="EventLocation">
    {{ locationString }}
  </NuxtLink>
</template>
