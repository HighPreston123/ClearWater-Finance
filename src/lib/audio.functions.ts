import { createServerFn } from "@tanstack/react-start";
import { requireAuthWithMfa } from "@/lib/mfa-middleware";
import type { ServiceResult } from "@/services/types";

// George — a supported ElevenLabs premade voice. Turbo v2.5 = fast, high quality.
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_turbo_v2_5";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Converts the Overview's written summary to speech. The API key never leaves the server. */
export const generateAudioSummary = createServerFn({ method: "POST" })
  .middleware([requireAuthWithMfa])
  .inputValidator((input: { text: string }) => {
    const text = typeof input?.text === "string" ? input.text.trim() : "";
    if (!text || text.length > 2000) throw new Error("Invalid summary text");
    return { text };
  })
  .handler(async ({ data }): Promise<ServiceResult<{ audioBase64: string; mimeType: string }>> => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) return { status: "not_configured", message: "Audio summary isn't connected yet." };
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: data.text, model_id: MODEL_ID, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        console.error(`[elevenlabs] TTS failed [${res.status}]: ${body}`);
        const msg = res.status === 401 ? "The audio service rejected the API key." : res.status === 429 ? "The audio service is busy or out of credits. Try again later." : "Audio generation failed. Please try again.";
        return { status: "error", message: msg };
      }
      return { status: "ok", data: { audioBase64: toBase64(await res.arrayBuffer()), mimeType: "audio/mpeg" }, source: "elevenlabs", fetchedAt: new Date().toISOString() };
    } catch (e) {
      console.error("[elevenlabs] request error", String((e as Error)?.message ?? e));
      return { status: "error", message: "Couldn't reach the audio service." };
    }
  });
