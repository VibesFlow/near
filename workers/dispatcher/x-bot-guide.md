# Making X Bots Guide

For help developing and deploying your shade agent, join the [Shade Agents Dev Group](https://t.me/shadeagents)!

# X (Twitter) Libraries (for NodeJS)

There are 2 main choices for X (Twitter) integration and there are pros and cons to both.

1. Cookie Auth - create an account, sign in using the browser, copy some variables from the local storage / cookies and then place these in your env vars.

Cookie Auth will let you get started right away. Your mileage might vary given that you might hit arbitrary rate limits, or be seen as a spam bot if the account is brand new and has few followers. But you should be able to search out of the box and work with some basic functionality.

2. API Account - create a developer account, create an app, issue a client ID and client secret.

An API Account will give you full permissions (within rate limits) to do what you want. This is the best choice for production apps.

## Eliza OS Agent Twitter Client

Many bots use [Eliza OS Agent Twitter Client](https://github.com/elizaOS/agent-twitter-client) for their bots.

For more information on how to use this library for X via `shade-agent-js` lib, see [the Shade Agent JS repo](https://github.com/NearDeFi/shade-agent-js).

It is possible to use Eliza client with a paid account, but we encountered issues. We have only had it working with Cookie Auth by providing the env vars copied from the browser local storage after a sign in.

### Cookie Auth, Development

Using Eliza OS Agent Twitter Client, you can authenticate with cookies from the browser by copying and pasting them over to your environment variables.

A Shade Agent using this library with an explanation how to set this up can be found [here](https://github.com/NearDeFi/shade-agent-twitter).

Cookie authentication is fine for very low traffic, low risk bots, for example giving away airdrops, marketing or simply doing something fun.

However, when the stakes are a bit higher, such as providing a service, the risk of these bots getting rate limited is much higher than using the official API.

### Setup for Cookie Auth with Eliza OS Agent Twitter Client

Import the [the Shade Agent JS repo](https://github.com/NearDeFi/shade-agent-js).

This will expose the `"agent-twitter-client": "^0.0.17"` library.

You must provide env vars to use your Twitter account with this library:

```bash
TWITTER_AUTH_TOKEN=""
TWITTER_CT0=""
TWITTER_GUEST_ID=""
TWITTER_BEARER_TOKEN=""
```

Then you can import and use the twitter client using:

```js
import { SearchMode, twitter } from '@neardefi/shade-agent-js';

// Search for recent tweets
const tweets = scraper.searchTweets('#nodejs', 20, SearchMode.Latest);
```

## Twitter API V2 + Paid Account

This repo uses [Twitter API V2](https://github.com/plhery/node-twitter-api-v2#readme) for the bot and a paid plan for the API Account.

The rest of this documentation about setting up env vars is related to an API Account Auth Flow.

### ENV VARS

You will need to obtain the following env vars.

```bash
BASE_API_KEY: https://basescan.org/
TWITTER_API_KEY: app auth key
TWITTER_API_SECRET: app auth secret
TWITTER_CLIENT_KEY: for client auth, also referred to as client ID
TWITTER_CLIENT_SECRET: for client auth
TWITTER_ACCESS_TOKEN: after authenticating your X agent account with your app
TWITTER_REFRESH_TOKEN: same as above
TWITTER_LAST_TIMESTAMP: default 0
NEXT_PUBLIC_contractId: your shade agent contract ID
MPC_PUBLIC_KEY_TESTNET: https://docs.near.org/chain-abstraction/chain-signatures/implementation
MPC_PUBLIC_KEY_MAINNET: https://docs.near.org/chain-abstraction/chain-signatures/implementation
RESTART_PASS: custom password in case you need to trigger your agent via http for any reason
```

### Authenticating Your Agent with the Client ID and Secret

There's a utility NodeJS server in the file `/utils/auth.js` that you can run with node.

Edit this file to add your own callback URL. It MUST be HTTPS!

You will need to set up [ngrok](https://ngrok.com/) (or some alterative) to create your own callback URL.

Once you're ready, before you launch the server, make sure you're signed in to the X account you want to get the AUTH and REFRESH tokens for.

Start it up with node and navigate to `http://localhost:3000`

Authorize your app and then go back to your node console/terminal and you should see the AUTH and REFRESH tokens.

Copy these into your environment variables and you can now launch your agent.

# Bot Best Practices Searching and Tweeting

Whether you're using the agent-twitter-client or twitter-api-v2 the same principles apply.

It is important how your code will search, and tweet. Understanding your rate limits is essential to creating a good bot for X.

## Recommendation: Store Last Seen Posts

When using APIs like X, you'll be doing a search of all relevent posts matching your criteria, but you'll also need to load each tweet (read request). It's not well documented that each tweet read also counts towards a rate limit.

To avoid reading posts you've already seen before, store a `lastSeenTweet` timestamp and after you've parsed all the potential qualifying posts for your bot, separating out the valid posts where you need to take some action from the invalid posts that don't match criteria, you're going to want to add as a search parameter in your next call to the API the `start_time`.

An example using Twitter Client V2:

```js
const tweetGenerator = await client.v2.search('@basednames ".base.eth"', {
    start_time,
    'tweet.fields': 'author_id,created_at,referenced_tweets',
});
```

In general, don't request anything you've already seen before.

## Recommendation: Check Rate Limits

Checking the rate limit information returned to you from the API is prudent in a situation where you may be limited in the future.

Make sure you check these limits and what time your API service will return.

It's important to halt critical code and make sure you're not attempting to reply to messages while rate limited.

One nice thing about the X API is that rate limits are dependent on the service.

For example, search has nothing to do with posting tweets.

## Recommendation: Use a Database as a Backup

While this worker agent does not, it would be prudent for a more serious production application to use a database.

Once you find the posts you want to respond to, store these in a database and add flags such as `responded`, `awaiting_reply`, etc...

Additionally, store operating variables like `lastSeenTweet` from the recommendation above in an app field or table.

In this way, if you have to reboot the worker agent, you'll be able to pick up where you last left off.

## Recommendation: Timeout vs. Intervals

All [rate limits on X](https://docs.x.com/x-api/fundamentals/rate-limits) are measured in time increments, e.g. search for basic API plan is 60 searches in a 15 minute window.

Using an interval in JavaScript can be convenient but has some downsides. Intervals are based on "wall clock" time and don't take into account the time your code spends in an "await" for a response from an API. What will happen is that intervals will start to "bunch up" and your API calls will get closer and closer to each other, leading to unpredictable results.

Consider this code:

```js
async function doSomething() {
	await apiCall1();
	...
	await apiCall2();
}
setInterval(doSomething, 1000)
```

We're calling `doSomething` every second, but `apiCall1` could take several milliseconds or seconds to respond and `apiCall2` has not yet fired. Additionally, there is retry logic in Eliza OS Agent Twitter Client that will keep calling the API.

But the interval is still going, every second, no matter what happens inside the function.

### Use Timeouts

```js
async function doSomething() {
	await apiCall1();
	...
	await apiCall2();
	...
	setTimeout(doSomething, 1000)
}
doSomething()
```

Rewritten, our code now waits for all api calls to complete before moving on to the next iteration of our function call.

Given the heavy rate limiting of X, using either cookie auth or official API accounts, this method is much more preferable to ensure that the calls to the API will no exceed a certain amount of "wall clock" time, in which API usage is measured.

## Recommendation: Exception Handling

Exceptions will happen and uncaught exceptions can cause your bot to exit out of a function early and potentially disrupt other functions.

It's important that code calling APIs and using libraries be wrapped in a `try { ... } catch (error) { ... } finally { ... }`.

If you take the recommended route of using timeouts, these timeouts must be called after all `await` and code in the block executes, in order to resume the next iteration without disruption.

# Shade Agent Library

[Repo](https://github.com/NearDeFi/shade-agent-js/)

# Shade Agent Template

For help developing and deploying your shade agent Phala join the [Shade Agents Dev Group](https://t.me/shadeagents)!

[Repo](https://github.com/NearDeFi/shade-agent-template/)
