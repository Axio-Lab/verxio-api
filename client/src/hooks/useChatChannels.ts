import { useProtectedQuery } from "@/hooks/useProtectedApi";
import { authenticatedGet } from "@/lib/api-client";

export interface ChatChannel {
  id: string;
  platform: string;
  label: string;
  source: "support";
}

export function useChatChannels() {
  return useProtectedQuery<{ channels: ChatChannel[] }>({
    queryKey: ["chat-channels"],
    queryFn: async () => {
      const response = await authenticatedGet<{ success: boolean; channels: ChatChannel[] }>(
        "/api/support/channels/active"
      );
      return { channels: response.channels };
    },
  });
}
