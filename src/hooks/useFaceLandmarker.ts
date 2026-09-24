import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useEffect, useState } from "react";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const LOCAL_MODEL = `${import.meta.env.BASE_URL}models/face_landmarker.task`;
const REMOTE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

async function createLandmarker(delegate: "GPU" | "CPU", modelUrl: string) {
  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelUrl,
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
  });
}

export function useFaceLandmarker() {
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let instance: FaceLandmarker | null = null;

    (async () => {
      const modelUrl = (await modelExists(LOCAL_MODEL))
        ? LOCAL_MODEL
        : REMOTE_MODEL;
      const attempts: ("GPU" | "CPU")[] = ["GPU", "CPU"];
      let lastErr: unknown;
      for (const delegate of attempts) {
        try {
          const lm = await createLandmarker(delegate, modelUrl);
          if (cancelled) {
            lm.close();
            return;
          }
          instance = lm;
          setLandmarker(lm);
          setLoading(false);
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!cancelled) {
        setError(
          lastErr instanceof Error
            ? lastErr.message
            : "Face Landmarker 初始化失败",
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      instance?.close();
    };
  }, []);

  return { landmarker, error, loading };
}

async function modelExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
