# looking for co-maintainers 😇
if you'd like to help maintain bay.lgbt, please shoot me an email! I am actively looking for co-maintainers due to being short on time as of late. I'm looking for people who can implement features, fix bugs, and/or keep the list of event organizers up-to-date and curated! The latter doesn't require any coding experience.

# bay.lgbt
an lgbt events aggregator for the SF bay!
yes!

# The bay.lgbt story (filled with, choices)
- anarchism.nyc is pretty neat! I wonder if the bay has one
- let's rewrite the codebase, (✨ but using a frontend framework that might deprecate in a few years ✨)
- let's spend an unreasonable amount of time making it look pretty, before getting any functionality xd
- let's have the client fetch everything; too lazy to get a server run (haha)
- CORS, my old friend... time look for a free CORS proxy :3
- wow the rate limit for Eventbrite sucks. I also don't want client auth...
- ok fine let's make a server
- ...what if we also added server-side rendering?
- ...what if... we hosted on Vercel, despite being in debt?
- `stale-while-revalidate` arc: let's add excessive caching & rate limits so i can sleep at night
- why does everyone use Instagram for events?
- Please stop using Instagram for events. Please stop using Instagram for events. (x100)
- to parse Instagram posts for anything resembling a structured event format, we would probably need to use GPT
- we should also DB server to cache the results so I don't bleed money from OpenAI calls. But Vercel is serverless, so can't use sqlite... pain....
- why do some Instagram posts... only include event information in the image??
- Please stop using Instagram for events. Please stop using Instagram for events. (x100)
- let's add an OCR AI API 🫠
- *stares at Google's labyrinthian docs for 3 hours figuring out how to get auth*
- ok, it works! but any of these calls might fail... let's sketchily add caching at each step
- (Please stop using Instagram for events. Please stop using Instagram for events.) (x10)
- suddenly running into Vercel's [10 sec timeout](https://vercel.com/docs/concepts/limits/overview#general-limits:~:text=Serverless%20Function%20Execution%20Timeout%20(Seconds)) for Free tier (why does Eventbrite take so long??): more pain 😀. Fork $20/mo to Vercel for a 60 sec timeout instead
- open beta! (ꈍ ‿ ꈍ ✿)
- surprise surprise: Instagram's API is once again causing issues- 200 requests per hour (per user, of which there is 1 in this case). let's spread out the requests but milk that limit as much as possible.
- *adds many various other APIs (Wix, Squarespace, With Friends, etc.)*- not too bad but fearful that APIs make change/break at any time, haha...
- *adds a frightening number of event sources all around the bay*
- *realize the potential endless API hell I've gotten myself into*- *takes a cold shower and puts up Donation link*
- *Ivy politely asks [forbiddentickets.com](https://forbiddentickets.com/) to expose an events API, and they graciously agree ❤️*
- someone [forked](https://github.com/NatVIII/rva.rip) bay.lgbt for their city and I'm excited and a little nervous
- *Ivy hibernates for a few months*
- Nuxt (the JS framework) updated from version 2 to 3? I'll deal with this later, haha
- *Ivy hibernates for a few months*
- wow, web dev is pain (*puts up ad for co-maintainers*)

# Development

You can use the `dev` task to run the development environment locally. This will start up bay.lgbt on [localhost:3000](http://localhost:3000).

```
$ npm install --locked
$ npm run dev
```

## Environment Variables

There are a number of environment variables that you can set locally to influence the dev environment. Our server library Nitro has [its own variables](https://nitro.build/deploy/runtimes/node#environment-variables) as well. If a variable has a default value, it is indicated below.

```env
# Port the dev server should listen on
NITRO_PORT=3000

EVENTBRITE_API_KEY

GOOGLE_CALENDAR_API_KEY

# These next variables are required for displaying Instagram event data
INSTAGRAM_BUSINESS_USER_ID
INSTAGRAM_USER_ACCESS_TOKEN

GOOGLE_CLOUD_VISION_PRIVATE_KEY
GOOGLE_CLOUD_VISION_CLIENT_EMAIL

OPENAI_API_KEY

WIX_SYZYGY_COOP_API_KEY
WIX_SYZYGY_COOP_ACCOUNT_ID
WIX_SYZYGY_COOP_SITE_ID
```

# Funding
Donations to keep bay.lgbt running are appreciated! Transparently, here are the costs to maintain the site:
- Domain: $7.5/mo
- Verce1: $20/mo
- OpenAI: ~$2/mo
- Google Vision OCR: ~$5/mo
