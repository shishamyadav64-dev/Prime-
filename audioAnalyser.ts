let sharedCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let activeInputSource: MediaStreamAudioSourceNode | null = null;
let passiveMicStream: MediaStream | null = null;
let activeMode: 'none' | 'input' | 'output' = 'none';
let pulseEnvelope = 0;

function ensureAudioContext(): {ctx: AudioContext; analyser: AnalyserNode} | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  if (!sharedAnalyser) {
    sharedAnalyser = sharedCtx.createAnalyser();
    sharedAnalyser.fftSize = 128;
    sharedAnalyser.smoothingTimeConstant = 0.78;
  }
  return {ctx: sharedCtx, analyser: sharedAnalyser};
}

export function attachOutputAudioElement(audio: HTMLAudioElement): () => void {
  try {
    const setup = ensureAudioContext();
    if (!setup) return () => {};
    const {ctx, analyser} = setup;
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    activeMode = 'output';

    return () => {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // Ignore disconnect errors after element teardown
      }
      if (activeMode === 'output') activeMode = 'none';
    };
  } catch {
    return () => {};
  }
}

export function attachInputMediaStream(stream: MediaStream): () => void {
  try {
    const setup = ensureAudioContext();
    if (!setup) return () => {};
    const {ctx, analyser} = setup;
    if (activeInputSource) {
      try {
        activeInputSource.disconnect();
      } catch {
        // Ignore prior disconnect errors
      }
    }
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    activeInputSource = source;
    activeMode = 'input';

    return () => {
      try {
        source.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      if (activeInputSource === source) activeInputSource = null;
      if (activeMode === 'input') activeMode = 'none';
    };
  } catch {
    return () => {};
  }
}

export async function startPassiveMicAnalyser(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  if (passiveMicStream) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    passiveMicStream = stream;
    attachInputMediaStream(stream);
  } catch {
    // Browser blocked or mic held exclusively by SpeechRecognition; fallback envelope handles motion
  }
}

export function stopPassiveMicAnalyser(): void {
  if (activeInputSource) {
    try {
      activeInputSource.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    activeInputSource = null;
  }
  if (passiveMicStream) {
    passiveMicStream.getTracks().forEach((t) => t.stop());
    passiveMicStream = null;
  }
  if (activeMode === 'input') {
    activeMode = 'none';
  }
}

export function triggerVoicePulse(strength = 0.8): void {
  pulseEnvelope = Math.max(pulseEnvelope, Math.min(1, strength));
}

export function consumeVoicePulse(): number {
  const current = pulseEnvelope;
  pulseEnvelope *= 0.88;
  if (pulseEnvelope < 0.01) pulseEnvelope = 0;
  return current;
}

export function sampleLiveSpectrum(target: Uint8Array<ArrayBuffer>): boolean {
  if (!sharedAnalyser || activeMode === 'none') return false;
  sharedAnalyser.getByteFrequencyData(target);
  let sum = 0;
  for (let i = 0; i < target.length; i++) {
    sum += target[i];
  }
  return sum > 12;
}
