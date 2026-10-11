import { useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { generateAudioSummary } from "@/lib/audio.functions";
import type { AudioState } from "@/services/audio/audioClient";

// One generated clip per exact script — avoids repeat API calls when data hasn't changed.
const clipCache = new Map<string, string>();

/** Playback only — never requests microphone access, never autoplays without a click. */
export function AudioSummaryControls({ text }: { text: string }) {
  const generate = useServerFn(generateAudioSummary);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  // Data changed → drop the current player (cached clips stay for reuse).
  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
    setError(null);
  }, [text]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const attach = (url: string) => {
    const a = new Audio(url);
    a.onended = () => setState("stopped");
    a.onpause = () => { if (!a.ended && a.currentTime > 0) setState("paused"); };
    a.onplay = () => setState("playing");
    a.onerror = () => { setState("error"); setError("This browser couldn't play the audio."); setShowText(true); };
    audioRef.current = a;
    return a;
  };

  const listen = async () => {
    setError(null);
    if (audioRef.current) return void audioRef.current.play();
    let url = clipCache.get(text);
    if (!url) {
      setState("loading");
      try {
        const r = await generate({ data: { text } });
        if (r.status !== "ok") {
          setState(r.status === "not_configured" ? "not_configured" : "error");
          setError(r.message);
          setShowText(true);
          return;
        }
        url = `data:${r.data.mimeType};base64,${r.data.audioBase64}`;
        clipCache.set(text, url);
      } catch {
        setState("error");
        setError("Audio generation failed. Please try again.");
        setShowText(true);
        return;
      }
    }
    try { await attach(url).play(); } catch { setState("error"); setError("Playback was blocked. Press play to try again."); }
  };

  const pause = () => audioRef.current?.pause();
  const stop = () => { const a = audioRef.current; if (a) { a.currentTime = 0; a.pause(); } setState("stopped"); };
  const replay = () => { const a = audioRef.current; if (a) { a.currentTime = 0; void a.play(); } else void listen(); };

  const loading = state === "loading";
  const hasClip = !!audioRef.current;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Audio summary">
        <Button variant="glass" size="sm" onClick={listen} disabled={loading || state === "playing"} title="Listen to a spoken summary">
          {loading ? <Loader2 className="animate-spin" /> : <Headphones />} {loading ? "Generating…" : "Listen to summary"}
        </Button>
        <Button variant="ghost" size="icon" disabled={!hasClip || state === "playing"} onClick={() => audioRef.current?.play()} aria-label="Play"><Play /></Button>
        <Button variant="ghost" size="icon" disabled={state !== "playing"} onClick={pause} aria-label="Pause"><Pause /></Button>
        <Button variant="ghost" size="icon" disabled={!hasClip || state === "stopped"} onClick={stop} aria-label="Stop"><Square /></Button>
        <Button variant="ghost" size="icon" disabled={!hasClip} onClick={replay} aria-label="Replay"><RotateCcw /></Button>
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowText((v) => !v)}>{showText ? "Hide text" : "Show text"}</button>
      </div>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {error ?? (state === "playing" ? "Playing…" : state === "paused" ? "Paused" : state === "stopped" && hasClip ? "Finished" : "")}
      </span>
      {showText && <p className="max-w-xl rounded-2xl border bg-card p-3 text-left text-sm">{text}</p>}
    </div>
  );
}
