<script setup lang="ts">
import './SingleEvent.css';

const props = defineProps<{
  event: any // Declare the event prop here
}>()
const emit = defineEmits<{
  (e: 'confirm'): void
}>()

const { event } = props;

// Constants that are used for storing shorthand event information
const eventTitle = event.title;

const toDate = (date: Date | string) => typeof date === 'string' ? new Date(date) : date;

const start = toDate(event.start);
const end = toDate(event.end);

const startTime = start.toLocaleDateString() + ' @ ' +
  start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const eventURL = event.extendedProps.originalUrl;
const eventID = event.id;
const eventLocation = event.extendedProps.location;
const eventDescription = event.extendedProps.description;
const eventImages = event.extendedProps.images;

let eventDescriptionNewlines;
if (eventDescription) {
	eventDescriptionNewlines = eventDescription.trim().replaceAll(/^(\s*\n)+$/gm, '<br>');
}


// For displaying multiple images
const getImageClass = (index: number) => {
  const classes = ['single', 'double', 'triple'];
  return classes[index] || '';
};


const urlIfy = (fragment: string): string =>
	 fragment
		.toLowerCase()
		.replace(/^\s+/, '')
		.replace(/\s+$/, '')
		.replaceAll(/[()]*/g, '')
		.replaceAll(/[^a-zA-Z0-9]+/g, '-')
		.replaceAll(/-+/g, '-');


const organizerId = event.extendedProps.organizerId;
const organizerName = event.extendedProps.organizer;
const organizerSlug = urlIfy(organizerName);

const organizerLink = `/o/${organizerId}/${organizerSlug}`;

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
    It is unsafe to allow injection of arbitrary HTML into your Vue page. Both /api/events/list and
    /api/events/[id]/[slug] run sanitize-html over the event description blocks before returning them to the client,
    this is the only reason it's acceptable to use v-html here.
    ===============
    -->
        <div v-if="eventDescriptionNewlines" v-html="eventDescriptionNewlines"></div>
        <div v-else>
          <p>We do not have a description for this event :(</p>
          <p>Please visit the <a :href="eventURL">organizer's event page</a> for more information.</p>
        </div>

        <hr>
        <div class="SingleEvent-bottom">
          <OldSchoolButton :to="eventURL">View Original</OldSchoolButton>

          <OldSchoolButton :to="{path: organizerLink}">
            More from {{organizerName}}
           </OldSchoolButton>
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
