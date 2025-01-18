<script setup lang="ts">
import './SingleEvent.css';

const props = defineProps<{
  event: any // Declare the event prop here
}>()
const emit = defineEmits<{
  (e: 'confirm'): void
}>()

// Development environment flag
const isDevelopment = process.env.NODE_ENV === 'development';

const { event } = props;

// Constants that are used for storing shorthand event information
const eventTitle = event.title;

const toDate = (date: Date | string) => typeof date === 'string' ? new Date(date) : date;

const start = toDate(event.start);
const end = toDate(event.end);

const startTime = start.toLocaleDateString() + ' @ ' +
  start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const eventHost = event.extendedProps.org;
const eventURL = event.extendedProps.originalUrl;
const eventID = event.id;
const eventLocation = event.extendedProps.location;
const eventDescription = event.extendedProps.description;
const eventImages = event.extendedProps.images;

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
  <div class="SingleEvent">
    <div>
      <OldSchoolWindow :title="eventTitle">
        <p>{{ startTime }}</p>
        <EventLocation :location="eventLocation" />
        <hr>

        <!--
    === SAFETEY ===
    It is unsafe to allow injection of arbitrary HTML into your Vue page. Both /api/events/events and
    /api/events/instagram run sanitize-html over the event description blocks before returning them to the client,
    this is the only reason it's acceptable to use v-html here.
    ===============
    -->
        <div v-if="eventDescription" v-html="eventDescription"></div>
        <div v-else>
          <p>We do not have a description for this event :(</p>
          <p>Please visit the <a :href="eventURL">organizer's event page</a> for more information.</p>
        </div>
        <!-- <span class="event-headers">Event Location:</span> <a :href="createGoogleMapsURL(eventLocation)" target="_blank">{{ eventLocation }}</a> -->

        <hr>
        <div class="SingleEvent-bottom">
          <OldSchoolButton :to="eventURL">View Original</OldSchoolButton>
          <!-- <OldSchoolButton :to="{ name: 'o-organizer', props: { organizer: props.event.extendedProps.organizer } }"> -->
          <!-- More from {{ props.event.extendedProps.organizer }} -->
          <!-- </OldSchoolButton> -->
        </div>
      </OldSchoolWindow>
    </div>

    <div v-if="eventImages && eventImages.length > 0">
      <OldSchoolWindow title="Images">
        <div class="image-container">
          <div class="image-wrapper" v-for="( url, index ) in  eventImages " :key="index">
            <img class="event-image" :src="url" :class="getImageClass(index)" />
          </div>
        </div>
      </OldSchoolWindow>
    </div>
  </div>
</template>
