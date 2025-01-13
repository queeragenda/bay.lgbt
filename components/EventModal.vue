<script setup lang="ts">
import { VueFinalModal } from 'vue-final-modal'
import sanitizeHtml from 'sanitize-html';

const props = defineProps<{
  event: any // Declare the event prop here
}>()
const emit = defineEmits<{
  (e: 'confirm'): void
}>()

// Development environment flag
const isDevelopment = process.env.NODE_ENV === 'development';

// Constants that are used for storing shorthand event information
const eventTitle = props.event.event.title;
const eventTime = props.event.event.start.toLocaleDateString() + ' @ ' +
  props.event.event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const eventHost = props.event.event.extendedProps.org;
const eventURL = props.event.event.url;
const eventID = props.event.event.id;
const eventLocation = props.event.event.extendedProps.location;
const eventDescription = props.event.event.extendedProps.description;
const eventImages = props.event.event.extendedProps.images;

//For interpreting the location into a google maps recognizable address
function createGoogleMapsURL(location: string) {
  const encodedLocation = encodeURIComponent(location); // Encode the location string to make it URL-friendly
  const googleMapsURL = `https://www.google.com/maps/search/?q=${encodedLocation}`; // Make the Google Maps URL with the location as the parameter
  return googleMapsURL;
}

// Function to extract image urls from the eventDescription and construct a new URL
// pointing towards your serverless function
// const getImageUrls = () => {
//   return eventImages.slice(0, 3).map(url => `/api/fetchImage?url=${encodeURIComponent(url)}`);
// };

// let errorMessages = ref([]); // To store error messages relating to image display

// const handleImageError = (index: number) => {
//   errorMessages.value[index] = `Failed to load image at ${index + 1}. This might be caused by an invalid image URL, or the image size is larger than 5MB.`;
// };

// For displaying multiple images
const getImageClass = (index: number) => {
  const classes = ['single', 'double', 'triple'];
  return classes[index] || '';
};
</script>

<template>
  <VueFinalModal class="popper-box-wrapper" content-class="popper-box-inner" overlay-transition="vfm-fade"
    content-transition="vfm-fade">
    <!-- Display Event Details -->
    <div class="event-details">
      <h1>{{ eventTitle }}</h1>
      <p>{{ eventTime }}</p>
      <p>{{ eventDescription }}</p><br>
      <!-- <span class="event-headers">Event Location:</span> <a :href="createGoogleMapsURL(eventLocation)" target="_blank">{{ eventLocation }}</a> -->

      <div class="image-container">
        <div class="image-wrapper" v-for="(url, index) in eventImages" :key="index">
          <img class="event-image" :src="url" :class="getImageClass(index)" />
        </div>
      </div>
    </div>

    <!-- Add a "Done" button -->
    <div class="bottom">
      <button @click="emit('confirm')">
        Close
      </button>
      <a :href="eventURL"><button type="button">View Original</button></a>
    </div>
  </VueFinalModal>
</template>
