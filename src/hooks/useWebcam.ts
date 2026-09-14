import { useCallback, useEffect, useRef, useState } from "react";

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("video element missing");
      }
      video.srcObject = stream;
      await video.play();
      setReady(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const message =
        name === "NotAllowedError" || name === "NotFoundError"
          ? name
          : err instanceof Error
            ? err.message
            : "unavailable";
      setError(message);
      setReady(false);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, ready, error, start, stop };
}
