import type { SignificantTweetItem } from "@/lib/api";
import { formatNumber, formatDate, impactLabel } from "@/lib/format";

export function TweetCard({ item }: { item: SignificantTweetItem }) {
  const tweet = item.tweet;

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
          Score: {item.significanceScore.toFixed(1)}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
          {impactLabel(item.impactType)}
        </span>
        {item.assets.map((asset) => (
          <span
            key={asset}
            className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
          >
            {asset}
          </span>
        ))}
      </div>

      <p className="mb-2 line-clamp-3 text-sm text-zinc-800">
        {tweet.fullText}
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <span className="text-xs text-zinc-500">
          Conviction:{" "}
          <span className="font-medium text-zinc-700">{item.conviction}</span>
        </span>
        <span className="text-xs text-zinc-500">
          Sentiment:{" "}
          <span className="font-medium text-zinc-700">{item.sentiment}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span>{formatNumber(tweet.favoriteCount)} likes</span>
        <span>{formatNumber(tweet.retweetCount)} RT</span>
        <span>{formatNumber(tweet.viewsCount)} views</span>
        <span>{formatDate(tweet.postedAt)}</span>
        <a
          href={`https://x.com/i/status/${tweet.tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View on X
        </a>
      </div>
    </div>
  );
}
