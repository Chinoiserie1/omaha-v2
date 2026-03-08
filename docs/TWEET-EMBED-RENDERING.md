# Tweet Embed Rendering in React Native

How we render tweets in the Explore tab's SignalCard component. Documents approaches tried, what failed, and the final working solution.

## Final Architecture

**Two-tier display**: text-first, embed on demand.

1. **Default**: Quoted tweet text (`fullText`) with category label and colored left border. Instant, no network request.
2. **On tap "View Tweet"**: Loads full embedded tweet via WebView using Twitter's `widgets.js`. Shows media, images, verified badges, engagement — the real tweet.

**Why**: Embedding tweets via WebView takes 2-5 seconds per card. Loading all embeds in a scrolling list kills performance. Text-first keeps the feed snappy; the rich embed is opt-in.

**Files**:
- `apps/native/components/explore/SignalCard.tsx` — Card with `expanded` state toggle
- `apps/native/components/explore/TweetEmbed.tsx` — WebView embed component

---

## What Failed: `platform.twitter.com/embed/Tweet.html`

### The Approach

Load Twitter's own embed page directly:

```tsx
<WebView source={{ uri: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true` }} />
```

The tweet renders correctly (dark theme, media, badges). But the **WebView height cannot be auto-sized** — there's always a huge empty space below the tweet content.

### Why It Fails

Twitter's embed page sets:

```css
html, body { height: 100%; }
```

This forces the page to fill the WebView's viewport. All standard height measurement techniques return the **viewport height**, not the **content height**:

- `document.body.scrollHeight` → viewport height
- `document.documentElement.scrollHeight` → viewport height
- `document.body.offsetHeight` → viewport height
- `document.body.getBoundingClientRect().height` → viewport height

### Attempted Fixes (All Failed)

1. **Injected CSS override** (`injectedJavaScript`):
   ```js
   style.textContent = 'html, body { height: auto !important; min-height: 0 !important; }';
   ```
   Twitter's JS re-applies the 100% height after our override runs.

2. **MutationObserver on body**: Twitter's resize logic is in an iframe within the page — can't observe cross-origin iframe mutations.

3. **Polling `scrollHeight` at intervals**: Returns viewport height every time since the CSS override gets clobbered.

4. **Measuring specific tweet widget elements**: The tweet content is inside a cross-origin iframe (`syndication.twitter.com`), so we can't access its DOM from the parent page.

5. **`onContentSizeChange` WebView prop**: Not reliable — fires with viewport dimensions, not content dimensions.

6. **Starting with a very large height then shrinking**: The page still reports its full height as 100% of whatever we give it.

**Bottom line**: When navigating to Twitter's embed page, they control the HTML/CSS/JS. We can't reliably override their layout to measure content height.

---

## What Works: Self-Hosted HTML + `twttr.widgets.createTweet()`

### The Approach

Build our own HTML page as a string, load Twitter's `widgets.js`, and call `twttr.widgets.createTweet()` to render the tweet into a div we control.

```tsx
<WebView
  source={{ html: buildTweetHtml(tweetId), baseUrl: "https://platform.twitter.com" }}
  ...
/>
```

### Why It Works

We own the HTML page. Our CSS sets `html, body { height: auto }` and **nothing overrides it** because Twitter's widget JS only styles the tweet widget element, not our page's html/body.

After `createTweet()` resolves, we measure `container.offsetHeight` — which correctly returns the rendered tweet's height because the page shrink-wraps to content.

### Key Implementation Details

```js
// Build a clean HTML page
<style>
  html, body {
    background: transparent;
    overflow: hidden;
    /* NO height: 100% — page shrink-wraps to content */
  }
</style>

// Load Twitter's widget JS
window.twttr = (function(d, s, id) { ... })(document, "script", "twitter-wjs");

// Render tweet into our container
twttr.widgets.createTweet(tweetId, container, {
  theme: "dark",
  dnt: true,           // Do Not Track
  conversation: "none" // Hide reply thread
}).then(function(el) {
  // Measure container.offsetHeight → post to React Native
});
```

### Height Measurement

Poll `container.offsetHeight` after tweet renders, since images/media load asynchronously and change the height:

```js
var iv = setInterval(function() {
  var h = container.offsetHeight;
  if (h > 20 && Math.abs(h - last) > 2) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "height", value: h }));
  }
  if (++count > 30) clearInterval(iv);
}, 300);
```

On the React Native side, set a default height (300) while loading, then update to the measured height:

```tsx
const [height, setHeight] = useState<number | null>(null);
// ...
<View style={{ height: height ?? 300 }}>
```

### WebView Props That Matter

```tsx
<WebView
  source={{ html, baseUrl: "https://platform.twitter.com" }}
  // baseUrl is REQUIRED — widgets.js needs a real origin for API calls
  scrollEnabled={false}
  javaScriptEnabled      // Required for widgets.js
  domStorageEnabled       // Required for Twitter's JS
  originWhitelist={["*"]} // Allow loading from any origin
  mixedContentMode="always" // Allow HTTPS resources from HTTP context
  onMessage={onMessage}   // Receive height measurements
/>
```

`baseUrl: "https://platform.twitter.com"` is critical. Without it, `widgets.js` fails to load or authenticate API calls for tweet data.

---

## Performance Considerations

- Each `TweetEmbed` spins up a full WebView instance — heavy on memory
- Loading `widgets.js` + fetching tweet data takes 2-5 seconds per embed
- Never render multiple TweetEmbeds simultaneously in a scrolling list
- The text-first approach means 0 WebViews until the user explicitly taps "View Tweet"
- `useMemo` on the HTML string prevents re-building it on every render
- When collapsed, the WebView unmounts entirely (no background resource usage)

---

## Alternative Approaches Not Tried

| Approach | Why Skipped |
|----------|-------------|
| `react-native-autoheight-webview` | Third-party dep; our custom solution works |
| `react-native-tweet-embed` | Uses same `widgets.js` approach; our impl is simpler |
| Iframely embed API | External service dependency, paid for volume |
| Screenshot/image of tweet | Would need a server-side renderer, loses interactivity |
| Twitter API oEmbed (`/oembed`) | Returns HTML string meant for web, same WebView height issues |
