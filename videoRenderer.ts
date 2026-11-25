import type {
  CaptionCue,
  PrimeSettings,
  VideoProject,
  YouTubeVideoTheme,
} from '../types/prime.ts';

function resolveThemeAccent(theme?: YouTubeVideoTheme, tone?: string): string {
  if (theme === 'cyan') return '#38BDF8';
  if (theme === 'emerald') return '#34D399';
  if (theme === 'crimson') return '#FB7185';
  if (theme === 'gold') return '#E5C07B';
  return tone === 'cyan' ? '#38BDF8' : tone === 'emerald' ? '#34D399' : '#E5C07B';
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function toSrtTimestamp(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function buildSyncedCaptions(project: VideoProject, totalDurationSec: number): {
  captions: CaptionCue[];
  srtText: string;
} {
  const rawTotal = project.scenes.reduce((acc, s) => acc + s.durationSec, 0) || 1;
  const scale = totalDurationSec / rawTotal;
  let cursor = 0;
  const captions: CaptionCue[] = [];

  for (const scene of project.scenes) {
    const scaledSceneDur = scene.durationSec * scale;
    const sentences = scene.narration
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const chunks = sentences.length > 0 ? sentences : [scene.narration];
    const slice = scaledSceneDur / chunks.length;

    for (const line of chunks) {
      captions.push({
        index: captions.length + 1,
        startSec: Number(cursor.toFixed(2)),
        endSec: Number((cursor + slice).toFixed(2)),
        text: line,
      });
      cursor += slice;
    }
  }

  const srtText = captions
    .map(
      (c) =>
        `${c.index}\n${toSrtTimestamp(c.startSec)} --> ${toSrtTimestamp(c.endSec)}\n${c.text}\n`,
    )
    .join('\n');

  return {captions, srtText};
}

export async function renderProjectThumbnail(
  project: VideoProject,
  theme?: YouTubeVideoTheme,
): Promise<{
  thumbnailBlob: Blob;
  thumbnailDataUrl: string;
}> {
  const width = project.format === '9:16' ? 720 : 1280;
  const height = project.format === '9:16' ? 1280 : 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D rendering is not supported.');

  const tone = project.scenes[0]?.accentTone ?? 'gold';
  const accentHex = resolveThemeAccent(theme, tone);

  // Deep obsidian backdrop
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#060911');
  bg.addColorStop(0.55, '#0D1422');
  bg.addColorStop(1, '#141D2F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(36, 50, 74, 0.35)';
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Dramatic focal radial glow
  const glow = ctx.createRadialGradient(
    width * 0.72,
    height * 0.35,
    30,
    width * 0.72,
    height * 0.35,
    Math.max(width, height) * 0.6,
  );
  glow.addColorStop(0, `${accentHex}44`);
  glow.addColorStop(0.6, `${accentHex}12`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Outer editorial frame
  ctx.strokeStyle = `${accentHex}88`;
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  // Top studio eyebrow
  ctx.fillStyle = accentHex;
  ctx.font = `700 ${project.format === '9:16' ? 24 : 22}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('PRIME STUDIO EDITION', 72, 92);

  // Accent bar
  ctx.fillRect(72, 112, 120, 5);

  // Bold High-CTR Thumbnail Hook
  const hookText = (project.thumbnailHook || project.title).toUpperCase();
  const hookSize = project.format === '9:16' ? 76 : 86;
  ctx.fillStyle = '#F8FAFC';
  ctx.font = `800 ${hookSize}px "Plus Jakarta Sans", sans-serif`;
  const hookLines = wrapCanvasText(ctx, hookText, width - 144).slice(0, 3);
  let y = project.format === '9:16' ? height * 0.36 : height * 0.42;
  for (const line of hookLines) {
    ctx.fillText(line, 72, y);
    y += hookSize * 1.12;
  }

  // Subhead
  const subText = project.thumbnailSubhead || project.scenes[0]?.visualSubtext || '';
  if (subText) {
    ctx.fillStyle = '#CBD5E1';
    const subSize = project.format === '9:16' ? 32 : 34;
    ctx.font = `500 ${subSize}px "DM Sans", sans-serif`;
    const subLines = wrapCanvasText(ctx, subText, width - 144).slice(0, 2);
    y += 18;
    for (const line of subLines) {
      ctx.fillText(line, 72, y);
      y += subSize * 1.3;
    }
  }

  // Bottom highlight bar & metadata
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 22px "JetBrains Mono", monospace`;
  const totalSec = Math.round(project.scenes.reduce((a, s) => a + s.durationSec, 0));
  ctx.fillText(
    `${project.format === '9:16' ? 'SHORTS' : 'HD 16:9'} · ${project.scenes.length} SCENES · ~${totalSec}S`,
    72,
    height - 68,
  );

  const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode thumbnail JPEG.'))),
      'image/jpeg',
      0.92,
    );
  });

  return {thumbnailBlob, thumbnailDataUrl};
}

export async function renderProjectVideo(
  project: VideoProject,
  settings: PrimeSettings,
  onProgress: (stage: string, pct: number) => void,
  options?: {
    useFreeSynthAudio?: boolean;
    ambientMusicEnabled?: boolean;
    theme?: YouTubeVideoTheme;
  },
): Promise<{
  videoBlob: Blob;
  videoUrl: string;
  syncedCaptions: CaptionCue[];
  syncedSrt: string;
  durationSec: number;
}> {
  const fullNarration = project.scenes.map((s) => s.narration).join(' ');
  onProgress(
    options?.useFreeSynthAudio
      ? 'Preparing Free Studio audio bed...'
      : 'Synthesizing voiceover narration...',
    15,
  );

  let audioArrayBuffer: ArrayBuffer | null = null;
  if (!options?.useFreeSynthAudio) {
    try {
      const ttsRes = await fetch('/api/prime/tts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: fullNarration,
          voiceName: settings.geminiVoicePersona,
          vocalStyle: settings.vocalStyle,
        }),
      });
      if (ttsRes.ok) {
        const ttsJson = (await ttsRes.json()) as {audioBase64?: string};
        if (ttsJson.audioBase64) {
          const binary = atob(ttsJson.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          audioArrayBuffer = bytes.buffer;
        }
      }
    } catch {
      audioArrayBuffer = null;
    }
  }

  const width = project.format === '9:16' ? 720 : 1280;
  const height = project.format === '9:16' ? 1280 : 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D rendering is not supported in this browser.');

  const audioCtx = new AudioContext();
  let audioBuffer: AudioBuffer | null = null;
  if (audioArrayBuffer) {
    try {
      audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer.slice(0));
    } catch {
      audioBuffer = null;
    }
  }

  const fallbackDuration = Math.max(
    12,
    project.scenes.reduce((acc, s) => acc + s.durationSec, 0),
  );
  const totalDurationSec = audioBuffer ? Math.max(4, audioBuffer.duration + 0.6) : fallbackDuration;
  const {captions: syncedCaptions, srtText: syncedSrt} = buildSyncedCaptions(
    project,
    totalDurationSec,
  );

  // Build scene timeline windows matching totalDurationSec
  const rawTotal = project.scenes.reduce((acc, s) => acc + s.durationSec, 0) || 1;
  const sceneTimeline: Array<{start: number; end: number; scene: VideoProject['scenes'][number]}> =
    [];
  let cursor = 0;
  for (const s of project.scenes) {
    const dur = (s.durationSec / rawTotal) * totalDurationSec;
    sceneTimeline.push({start: cursor, end: cursor + dur, scene: s});
    cursor += dur;
  }

  const canvasStream = canvas.captureStream(30);
  const destNode = audioCtx.createMediaStreamDestination();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;

  let sourceNode: AudioBufferSourceNode | null = null;
  if (audioBuffer) {
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(analyser);
    analyser.connect(destNode);
  }

  // Subtle royalty-free synthesized studio ambient chord bed when enabled or when running offline/free synth
  const shouldPlayAmbient = Boolean(options?.ambientMusicEnabled || !audioBuffer);
  const ambientNodes: OscillatorNode[] = [];
  if (shouldPlayAmbient) {
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = audioBuffer ? 0.045 : 0.08;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;

    const chordFreqs = [130.81, 196.0, 261.63]; // C3, G3, C4 warm studio pad
    for (const freq of chordFreqs) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(filter);
      ambientNodes.push(osc);
    }
    filter.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(destNode);
  }

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destNode.stream.getAudioTracks(),
  ]);

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: preferredMime,
    videoBitsPerSecond: 2_800_000,
  });

  const recordedChunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) recordedChunks.push(ev.data);
  };

  onProgress('Rendering HD scenes, waveform & auto-captions...', 30);

  return new Promise((resolve, reject) => {
    let rafId = 0;
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    recorder.onstop = () => {
      cancelAnimationFrame(rafId);
      audioCtx.close().catch(() => {});
      const videoBlob = new Blob(recordedChunks, {type: 'video/webm'});
      const videoUrl = URL.createObjectURL(videoBlob);
      onProgress('Video render complete', 100);
      resolve({
        videoBlob,
        videoUrl,
        syncedCaptions,
        syncedSrt,
        durationSec: totalDurationSec,
      });
    };

    recorder.onerror = () => {
      cancelAnimationFrame(rafId);
      audioCtx.close().catch(() => {});
      reject(new Error('Video MediaRecorder encountered an error.'));
    };

    recorder.start(250);
    const startPerf = performance.now();
      if (sourceNode) sourceNode.start();
      for (const osc of ambientNodes) osc.start();

      const drawFrame = () => {
        const elapsedSec = (performance.now() - startPerf) / 1000;
        const pct = Math.min(99, 30 + Math.round((elapsedSec / totalDurationSec) * 68));
        onProgress('Rendering HD scenes, waveform & auto-captions...', pct);

        const activeEntry =
          sceneTimeline.find((item) => elapsedSec >= item.start && elapsedSec < item.end) ??
          sceneTimeline[sceneTimeline.length - 1];
        const scene = activeEntry.scene;
        const accentHex = resolveThemeAccent(options?.theme, scene.accentTone);

      // Background obsidian gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#080C14');
      bgGrad.addColorStop(1, '#101724');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric glow
      const radial = ctx.createRadialGradient(
        width * 0.5,
        height * 0.36,
        20,
        width * 0.5,
        height * 0.36,
        Math.max(width, height) * 0.55,
      );
      radial.addColorStop(0, `${accentHex}28`);
      radial.addColorStop(1, 'transparent');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);

      // Top editorial header
      ctx.fillStyle = '#94A3B8';
      ctx.font = `600 ${project.format === '9:16' ? 22 : 20}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(
        `PRIME STUDIO  ·  SCENE ${scene.sceneNumber} OF ${project.scenes.length}`,
        64,
        72,
      );

      // Accent hairline
      ctx.fillStyle = accentHex;
      ctx.fillRect(64, 92, 96, 3);

      // Visual Headline
      ctx.fillStyle = '#F1F5F9';
      const headSize = project.format === '9:16' ? 54 : 62;
      ctx.font = `700 ${headSize}px "Plus Jakarta Sans", sans-serif`;
      const headlineLines = wrapCanvasText(ctx, scene.visualHeadline, width - 128);
      let y = project.format === '9:16' ? height * 0.28 : height * 0.30;
      for (const line of headlineLines.slice(0, 3)) {
        ctx.fillText(line, 64, y);
        y += headSize * 1.18;
      }

      // Visual Subtext
      if (scene.visualSubtext) {
        ctx.fillStyle = '#94A3B8';
        const subSize = project.format === '9:16' ? 30 : 30;
        ctx.font = `400 ${subSize}px "DM Sans", sans-serif`;
        const subLines = wrapCanvasText(ctx, scene.visualSubtext, width - 128);
        y += 16;
        for (const line of subLines.slice(0, 3)) {
          ctx.fillText(line, 64, y);
          y += subSize * 1.32;
        }
      }

      // Live audio bars
      analyser.getByteFrequencyData(freqData);
      const barCount = 24;
      const barAreaWidth = width - 128;
      const barStep = barAreaWidth / barCount;
      const baseBarY = height - (project.format === '9:16' ? 300 : 185);
      for (let i = 0; i < barCount; i++) {
        const energy = audioBuffer
          ? freqData[i % freqData.length] / 255
          : 0.2 + 0.25 * Math.abs(Math.sin(elapsedSec * 4 + i * 0.4));
        const barH = Math.max(6, energy * 52);
        ctx.fillStyle = `${accentHex}AA`;
        ctx.fillRect(64 + i * barStep, baseBarY - barH / 2, barStep * 0.55, barH);
      }

      // Auto-Captions overlay at bottom
      const activeCue = syncedCaptions.find(
        (c) => elapsedSec >= c.startSec && elapsedSec <= c.endSec,
      );
      if (activeCue) {
        const capSize = project.format === '9:16' ? 30 : 28;
        ctx.font = `600 ${capSize}px "DM Sans", sans-serif`;
        const capLines = wrapCanvasText(ctx, activeCue.text, width - 160).slice(0, 2);
        const boxHeight = capLines.length * (capSize * 1.35) + 28;
        const boxY = height - boxHeight - 54;

        ctx.fillStyle = 'rgba(8, 12, 20, 0.86)';
        ctx.beginPath();
        ctx.roundRect(48, boxY, width - 96, boxHeight, 12);
        ctx.fill();
        ctx.strokeStyle = '#24324A';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#F1F5F9';
        ctx.textAlign = 'center';
        let cy = boxY + capSize + 14;
        for (const line of capLines) {
          ctx.fillText(line, width / 2, cy);
          cy += capSize * 1.32;
        }
        ctx.textAlign = 'left';
      }

      // Bottom progress bar
      const progressRatio = Math.min(1, elapsedSec / totalDurationSec);
      ctx.fillStyle = '#161F30';
      ctx.fillRect(0, height - 6, width, 6);
      ctx.fillStyle = accentHex;
      ctx.fillRect(0, height - 6, width * progressRatio, 6);

      if (elapsedSec >= totalDurationSec) {
        recorder.stop();
      } else {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);
  });
}
