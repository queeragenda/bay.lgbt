<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()

const searchParams = new URLSearchParams({
  client_id: runtimeConfig.public.facebookClientId,
  redirect_uri: runtimeConfig.public.facebookLoginRedirect,
  // state: "todo uuid",
  scope: "pages_show_list,ads_management,business_management,instagram_basic,instagram_manage_insights,pages_read_engagement",
  response_type: "code",
});

const loginUrl = `https://www.facebook.com/v22.0/dialog/oauth?${searchParams.toString()}`;
</script>

<template>
  <OldSchoolWindow title="Facebook Login">
    <p>Hey gorge, I'm not really sure how you got here, but this probably isn't where you wanna be. This page is a part
      of our Instagram integration, it allows us to get user tokens for fetching Instagram posts. This page is
      <em>not</em> for adding new Instagram accounts for event scraping, it's really only helpful for admins of the
      website.
    </p>
    <OldSchoolButton :to="loginUrl">Login</OldSchoolButton>
  </OldSchoolWindow>
</template>
