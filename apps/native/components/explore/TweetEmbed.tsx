import { useState, useCallback, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

interface TweetEmbedProps {
  tweetId: string;
}

function buildTweetHtml(tweetId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: transparent;
    overflow: hidden;
    /* DO NOT set height:100% — we need shrink-wrap */
  }
  #container {
    display: inline-block;
    width: 100%;
  }
  /* Hide Twitter's follow button and branding for cleaner embed */
  .twitter-tweet { margin: 0 !important; }
</style>
</head>
<body>
<div id="container"></div>
<script>
  window.twttr = (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0],
      t = window.twttr || {};
    if (d.getElementById(id)) return t;
    js = d.createElement(s);
    js.id = id;
    js.src = "https://platform.twitter.com/widgets.js";
    fjs.parentNode.insertBefore(js, fjs);
    t._e = [];
    t.ready = function(f) { t._e.push(f); };
    return t;
  }(document, "script", "twitter-wjs"));

  twttr.ready(function() {
    twttr.widgets.createTweet(
      "${tweetId}",
      document.getElementById("container"),
      { theme: "dark", dnt: true, conversation: "none" }
    ).then(function(el) {
      if (!el) return;
      // Tweet rendered — measure the iframe or element height
      var last = 0;
      function measure() {
        var h = document.getElementById("container").offsetHeight;
        if (h > 20 && Math.abs(h - last) > 2) {
          last = h;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "height", value: h }));
        }
      }
      // Poll for a bit as images/media load and change height
      var count = 0;
      var iv = setInterval(function() {
        measure();
        if (++count > 30) clearInterval(iv);
      }, 300);
      measure();
    });
  });
</script>
</body>
</html>`;
}

export function TweetEmbed({ tweetId }: TweetEmbedProps) {
  const [height, setHeight] = useState<number | null>(null);

  const html = useMemo(() => buildTweetHtml(tweetId), [tweetId]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "height" && msg.value > 20 && msg.value < 1200) {
        setHeight(msg.value);
      }
    } catch {
      // ignore non-JSON messages
    }
  }, []);

  return (
    <View style={{ height: height ?? 300, borderRadius: 12, overflow: "hidden" }}>
      {height === null && (
        <View className="absolute inset-0 z-10 items-center justify-center">
          <ActivityIndicator size="small" color="#64748B" />
        </View>
      )}
      <WebView
        source={{ html, baseUrl: "https://platform.twitter.com" }}
        style={{
          flex: 1,
          backgroundColor: "transparent",
          opacity: height !== null ? 1 : 0,
        }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        originWhitelist={["*"]}
        mixedContentMode="always"
      />
    </View>
  );
}
