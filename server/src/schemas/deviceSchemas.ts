import { z } from "zod";

export const registerDeviceSchema = z.object({
  label: z.string().min(1, "label is required"),
  platform: z.enum(["android", "ios", "web"]),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
