import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/expo";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

export function useTwitterSync() {
  const { user, getAccessToken } = usePrivy();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!user || hasSynced.current) return;

    const twitterAccount = user.linked_accounts?.find(
      (account) => account.type === "twitter_oauth"
    );

    if (!twitterAccount) return;

    hasSynced.current = true;

    const twitterId = twitterAccount.subject;
    const twitterUsername =
      "username" in twitterAccount ? String(twitterAccount.username) : undefined;
    const profileImageUrl =
      "profilePictureUrl" in twitterAccount
        ? String(twitterAccount.profilePictureUrl)
        : undefined;
    const name =
      "name" in twitterAccount ? String(twitterAccount.name) : undefined;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        await fetch(`${API_URL}/api/profile/sync-twitter`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            twitterId,
            twitterUsername,
            profileImageUrl,
            name,
          }),
        });
      } catch {
        // Fire-and-forget — will retry next session
      }
    })();
  }, [user, getAccessToken]);
}
