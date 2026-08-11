// Replicate API client for Stable Video Diffusion (img-to-video).
//
// Stateless wrapper around Replicate's prediction API — POST creates a
// prediction, then we poll status until 'succeeded' or 'failed'. The
// final output is an MP4 URL hosted on Replicate's CDN (long-lived).
//
// Auth is via REPLICATE_API_TOKEN. Without it, all calls throw — the
// caller is expected to check beforehand and return a 503 to the UI.

// SVD-XT — 25 frames at user-chosen FPS. Stable Video Diffusion 1.1.
// Hash pinned for reproducibility.
const SVD_MODEL_VERSION =
  '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

type Prediction = {
  id: string;
  status: ReplicateStatus;
  output: string | string[] | null;
  error?: string | null;
  urls?: { get: string; cancel: string };
};

export type SVDOptions = {
  /** Public URL of the source image. Must be reachable by Replicate. */
  inputImageUrl: string;
  /** How much motion to apply. 100=subtle wag, 180=running. Default 127. */
  motionBucketId?: number;
  /** Frames per second of output. Default 6 (low res but loopable). */
  fps?: number;
  /** Total wait budget in ms before giving up. Default 90s. */
  pollTimeoutMs?: number;
};

/** Create a prediction + poll until it finishes. Returns the MP4 URL on
 *  success or throws on any error. */
export async function generateSVD(token: string, opts: SVDOptions): Promise<string> {
  const motion = opts.motionBucketId ?? 127;
  const fps = opts.fps ?? 6;
  const deadline = Date.now() + (opts.pollTimeoutMs ?? 90_000);

  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: SVD_MODEL_VERSION,
      input: {
        input_image: opts.inputImageUrl,
        video_length: '25_frames_with_svd_xt',
        sizing_strategy: 'maintain_aspect_ratio',
        frames_per_second: fps,
        motion_bucket_id: motion,
        cond_aug: 0.02,
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Replicate create failed: ${createRes.status} ${text.slice(0, 200)}`);
  }

  const created = (await createRes.json()) as Prediction;
  const pollUrl = created.urls?.get ?? `https://api.replicate.com/v1/predictions/${created.id}`;

  // Initial sleep so we don't hammer the API right after creation.
  await sleep(2000);

  while (Date.now() < deadline) {
    const r = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Replicate poll failed: ${r.status}`);
    const p = (await r.json()) as Prediction;
    if (p.status === 'succeeded') {
      const url = Array.isArray(p.output) ? p.output[0] : p.output;
      if (!url) throw new Error('Replicate succeeded but output was empty');
      return url;
    }
    if (p.status === 'failed' || p.status === 'canceled') {
      throw new Error(`Replicate ${p.status}: ${p.error ?? 'unknown'}`);
    }
    await sleep(3000);
  }
  throw new Error('Replicate generation timed out');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
