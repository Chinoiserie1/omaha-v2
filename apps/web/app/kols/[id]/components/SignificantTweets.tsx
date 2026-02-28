import type { SignificantTweetItem } from "@/lib/api";
import { TweetCard } from "./TweetCard";

export function SignificantTweets({
  tweets,
}: {
  tweets: SignificantTweetItem[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        Significant Tweets ({tweets.length})
      </h2>
      {tweets.length === 0 ? (
        <p className="text-sm text-zinc-500">No significant tweets yet.</p>
      ) : (
        <div className="space-y-3">
          {tweets.map((item) => (
            <TweetCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
