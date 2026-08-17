import { z } from "zod";
import { saveVideoPlaybackReport } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const reportInput = z.object({
  url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), "仅支持 HTTP 或 HTTPS 地址"),
  title: z.string().trim().min(1).max(512),
  provider: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1).max(128).default("playback_failed"),
});

export const videoReportsRouter = router({
  submit: publicProcedure.input(reportInput).mutation(async ({ input }) => ({
    accepted: true,
    stored: await saveVideoPlaybackReport(input),
  })),
});

export { reportInput };
