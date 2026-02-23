import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/expo";
import { useSyncTwitter } from "./queries/use-profile";

export function useTwitterSync() {
  const { user } = usePrivy();
  const hasSynced = useRef(false);
  const syncTwitter = useSyncTwitter();

  useEffect(() => {
    if (!user || hasSynced.current) return;

    const twitterAccount = user.linked_accounts?.find(
      (account) => account.type === "twitter_oauth"
    );

    if (!twitterAccount) return;

    hasSynced.current = true;

    const twitterId = twitterAccount.subject;
    const rawUsername =
      "username" in twitterAccount ? twitterAccount.username : undefined;
    const rawProfileImageUrl =
      "profile_picture_url" in twitterAccount
        ? (twitterAccount as unknown as Record<string, string>)["profile_picture_url"]
        : undefined;
    const rawName =
      "name" in twitterAccount ? twitterAccount.name : undefined;

    syncTwitter.mutate({
      twitterId,
      twitterUsername: rawUsername ? String(rawUsername) : undefined,
      profileImageUrl: rawProfileImageUrl
        ? String(rawProfileImageUrl)
        : undefined,
      name: rawName ? String(rawName) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}
