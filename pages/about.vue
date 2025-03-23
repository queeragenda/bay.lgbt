<script setup lang="ts">
const route = useRoute();
useHead({
  title: 'About Us'
});
</script>

<template>
  <OldSchoolWindow title="About Us">
    <div style="display: flex; align-items: center; flex-direction: row;">
      <div class="desc">
        <p>bay.lgbt was built with the personal hope that no LGBTQ+ person should be without community. The site will
          always be free, without frills, and remain a public utility. The events here are drawn from various <a
            href="https://github.com/queeragenda/bay.lgbt/blob/main/server/utils/event_sources.json">organizer listings</a> that
          contributors (thank you!) have provided. The listings are in a constant state of community-based vetting; don't
          hesitate to provide feedback <a href="https://forms.gle/DMt1xKyMKbHCsZMv5">here</a>!</p>
        <p>Before making plans, consider checking with venue staff or event organizers directly. This site is not
          affiliated with any events listed.</p>
        <p>In New York? Check out our sister site at <a href="https://anarchism.nyc/">anarchism.nyc</a>- this site
          wouldn't exist without it.</p>
        <p>Looking for a dedicated BDSM events calendar? Check out <a href="https://erobay.com/">erobay.com</a>.</p>
        <p>Looking for more electronic music? Check out <a
            href="https://19hz.info/eventlisting_BayArea.php">19hz.info</a>.
        </p>
        <p>Looking for chill (and free) events to go with your pup(s), partner(s), or thing(s) <a
            href="https://sf.funcheap.com/events/">sf.funcheap</a>.</p>
        <p>Want your event listed here? You must be publishing a machine-readable feed of event data formatted in <a
            href="https://fullcalendar.io/docs/event-source">a compatible Event Source format</a>. (This can be as simple
          as a <a href="https://support.google.com/calendar/answer/37083">public Google Calendar</a>.) Once published,
          request inclusion of your event feed by <a href="https://github.com/queeragenda/bay.lgbt/issues">submitting your
            event feed address to us via a new GitHub issue</a>. You may also provide feedback, fixes, or improvements
          there! Thanks to recent advances in AI, you may also share your events as Instagram posts, but it comes at the
          expense of accuracy and Ivy's budget (nonexistent). Donations are greatly appreciated and can be made <a
            href='https://ko-fi.com/ivyraine'>here</a>!</p>
      </div>
    </div>
  </OldSchoolWindow>
</template>
