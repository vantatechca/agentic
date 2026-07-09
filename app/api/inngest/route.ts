import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Inngest serve endpoint (spec §5). Registers all cron functions.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
