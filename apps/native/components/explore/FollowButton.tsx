import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/auth-context";
import { useFollowStatus } from "../../hooks/queries/use-follow-status";
import { useToggleFollow } from "../../hooks/mutations/use-toggle-follow";

interface FollowButtonProps {
  userId: string;
}

export function FollowButton({ userId }: FollowButtonProps) {
  const { status } = useAuth();
  const { data } = useFollowStatus(userId);
  const { mutate, isPending } = useToggleFollow(userId);

  if (status !== "authenticated") {
    return null;
  }

  const isFollowing = data?.isFollowing ?? false;

  return (
    <Pressable
      onPress={() => mutate()}
      disabled={isPending}
      className="ml-2 items-center justify-center p-1"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      <Ionicons
        name={isFollowing ? "star" : "star-outline"}
        size={22}
        color={isFollowing ? "#FBBF24" : "#94A3B8"}
      />
    </Pressable>
  );
}
