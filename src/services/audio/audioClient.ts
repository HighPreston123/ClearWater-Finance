import { FEATURES } from "@/config/features";
import { notConfigured, type ServiceResult } from "@/services/types";

export type AudioState = "not_configured" | "idle" | "loading" | "playing" | "paused" | "stopped" | "error";

/** Body of future POST /api/audio-summary. Returns playable audio. Never uses the microphone. */
export interface AudioSummaryRequest {
  text: string;
  voice?: string;
}
export interface AudioSummaryResponse {
  audioUrl: string;
  durationSeconds: number;
}

export async function requestAudioSummary(_req: AudioSummaryRequest): Promise<ServiceResult<AudioSummaryResponse>> {
  if (!FEATURES.audioSummary) return notConfigured("Audio summary");
  return notConfigured("Audio summary");
}
