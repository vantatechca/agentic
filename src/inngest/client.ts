import { Inngest } from "inngest";
import { APP_NAME } from "@/config/app";

/**
 * Inngest client for crons + events (spec §5). Signing/event keys are read from
 * env by Inngest automatically in production; in dev the Inngest dev server is
 * used (`npm run inngest:dev`).
 */
export const inngest = new Inngest({ id: APP_NAME.toLowerCase().replace(/\s+/g, "-") });
