/**
 * ============================================================================
 * Face verification — camera/liveness UI plumbing (interface contract)
 * ============================================================================
 * This file wires up the REAL browser plumbing needed for an in-browser face
 * check: camera access via `getUserMedia`, a simple liveness cue sequence
 * (countdown + multiple frame captures), and a pluggable `matchStrategy`
 * hook-point. It deliberately does NOT implement a production-grade
 * anti-spoofing/face-matching model — that is a substantial ML concern of
 * its own.
 *
 * To go to production, swap `matchStrategy` for something real, e.g.:
 *   - `face-api.js` with `TinyFaceDetector` + face descriptor comparison
 *     against the student's enrolled descriptor (see `StudentRecord.faceEnrolled`
 *     — the descriptor, never a raw photo, would be what's on file), or
 *   - a server-side call that receives the captured frames (or descriptors
 *     computed from them) and returns the verdict, keeping any real model
 *     off the client entirely.
 *
 * SECURITY NOTE — spoofing: a static photo held up to the camera must NEVER
 * pass. That is why `captureLivenessSequence` always grabs MULTIPLE frames
 * spaced out over the liveness-cue sequence (not a single snapshot) — any
 * real `matchStrategy` MUST check that consecutive frames actually differ
 * (blink/head-turn/etc actually happened) BEFORE it even attempts a face
 * match. A strategy that skips the liveness check and matches a single still
 * frame is a proxy-attendance hole.
 *
 * The default `placeholderMatchStrategy` always fails closed
 * (`livenessPassed:false, matchConfidence:0`) — see its own TODO — so this
 * module can be wired into the UI end-to-end today without ever falsely
 * approving anyone.
 * ============================================================================
 */

/** One captured video frame from the liveness sequence. */
export type FaceFrame = ImageData;

export interface FaceVerificationResult {
  livenessPassed: boolean;
  matchConfidence: number; // 0-1
}

/**
 * Pluggable matching/liveness-scoring strategy. Receives the captured frame
 * sequence (already multiple, time-spaced frames — never just one) plus the
 * studentId to match against their enrollment. Swap the default out for a
 * real implementation; see file header.
 */
export type MatchStrategy = (frames: FaceFrame[], studentId: string) => Promise<FaceVerificationResult>;

/**
 * TODO(face-recognition): replace this with a real liveness + match model.
 *
 * Why it always fails closed: there is no anti-spoofing/face-matching model
 * wired in yet. Returning a "pass" here — even optimistically — would mean
 * ANY photo held up to the camera marks the student present, which is
 * exactly the proxy-attendance hole this whole app exists to close. Fail
 * closed until a real `matchStrategy` (see file header) is swapped in.
 *
 * When replacing this:
 *   1. Verify `frames` actually differ frame-to-frame (liveness) — reject
 *      near-identical frames outright, that's a static photo.
 *   2. Only THEN run face matching against the student's enrolled
 *      descriptor (fetched by `studentId`), never a raw stored photo.
 *   3. Return a real `matchConfidence` (0-1) — don't hardcode 1.
 */
export const placeholderMatchStrategy: MatchStrategy = async (_frames, _studentId) => {
  return { livenessPassed: false, matchConfidence: 0 };
};

/** Liveness cues shown to the student while frames are captured, in order. */
export const DEFAULT_LIVENESS_CUES = ["Look straight at the camera", "Blink slowly", "Turn your head slightly"] as const;

export interface CaptureOptions {
  /** Number of frames to capture across the sequence. */
  frameCount?: number;
  /** Delay between captured frames, in ms. */
  intervalMs?: number;
  /** Called with the current cue text each time it changes, for UI display. */
  onCue?: (cue: string, frameIndex: number, totalFrames: number) => void;
}

/**
 * Manages the camera + liveness capture lifecycle for the face verification
 * step of the attendance flow. Instantiate once per attempt.
 */
export class FaceVerificationController {
  private stream: MediaStream | null = null;
  private frames: FaceFrame[] = [];
  private readonly matchStrategy: MatchStrategy;

  constructor(matchStrategy: MatchStrategy = placeholderMatchStrategy) {
    this.matchStrategy = matchStrategy;
  }

  /** Requests camera access (front-facing) and returns the live stream to attach to a <video>. */
  async openCamera(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported on this device.");
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      return this.stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") throw new Error("Camera permission denied. Allow camera access to verify your face.");
      if (name === "NotFoundError") throw new Error("No front-facing camera was found on this device.");
      throw new Error("Unable to access the camera. Please try again.");
    }
  }

  /**
   * Samples multiple frames from a currently-playing `<video>` element,
   * spaced out over `intervalMs`, prompting the student with a liveness cue
   * before each. Never a single snapshot — see file header on why.
   */
  async captureLivenessSequence(video: HTMLVideoElement, options: CaptureOptions = {}): Promise<FaceFrame[]> {
    const { frameCount = 5, intervalMs = 500, onCue } = options;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to process camera frames on this device.");

    const captured: FaceFrame[] = [];
    for (let i = 0; i < frameCount; i++) {
      const cue = DEFAULT_LIVENESS_CUES[i % DEFAULT_LIVENESS_CUES.length];
      onCue?.(cue, i, frameCount);
      // Give the student a beat to react to the cue before grabbing the frame.
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      captured.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }

    this.frames = captured;
    return captured;
  }

  /**
   * Runs the configured `matchStrategy` against the most recently captured
   * liveness sequence. Throws if no sequence has been captured yet.
   */
  async verifyAgainstEnrollment(studentId: string): Promise<FaceVerificationResult> {
    if (this.frames.length === 0) {
      throw new Error("Capture a liveness sequence before verifying.");
    }
    return this.matchStrategy(this.frames, studentId);
  }

  /** Stops all camera tracks. Always call this when leaving the face step. */
  closeCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
