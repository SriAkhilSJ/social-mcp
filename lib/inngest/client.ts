import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "socialix-ai-agent-team",
  name: "Socialix AI Agent Team",
  isDev: !process.env.INNGEST_SIGNING_KEY,
});
