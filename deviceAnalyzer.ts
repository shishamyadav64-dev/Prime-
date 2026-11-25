import type {DeviceTelemetry} from '../types/prime.ts';

async function estimateRefreshHz(): Promise<number> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return 60;
  }
  return new Promise((resolve) => {
    const timestamps: number[] = [];
    const maxSamples = 20;
    const step = (ts: number) => {
      timestamps.push(ts);
      if (timestamps.length < maxSamples) {
        window.requestAnimationFrame(step);
        return;
      }
      const deltas: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        const diff = timestamps[i] - timestamps[i - 1];
        if (diff > 2 && diff < 60) deltas.push(diff);
      }
      if (deltas.length === 0) {
        resolve(60);
        return;
      }
      deltas.sort((a, b) => a - b);
      const medianDelta = deltas[Math.floor(deltas.length / 2)];
      const rawHz = 1000 / medianDelta;
      if (rawHz >= 132) resolve(144);
      else if (rawHz >= 108) resolve(120);
      else if (rawHz >= 80) resolve(90);
      else resolve(60);
    };
    window.requestAnimationFrame(step);
  });
}

function getGpuRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'Unknown GPU';
    const webgl = gl as WebGLRenderingContext;
    const ext = webgl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return String(webgl.getParameter(webgl.RENDERER) || 'WebGL GPU');
    return String(
      webgl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ||
        webgl.getParameter(webgl.RENDERER) ||
        'WebGL GPU',
    );
  } catch {
    return 'Unknown GPU';
  }
}

function detectDeviceModelHint(ua: string): string {
  const androidMatch = ua.match(/Android\s+[\d.]+;\s*([^)]+)\)/i);
  if (androidMatch && androidMatch[1]) {
    return androidMatch[1].replace(/Build\/.*$/i, '').trim();
  }
  if (/iPhone/i.test(ua)) return 'Apple iPhone';
  if (/iPad/i.test(ua)) return 'Apple iPad';
  if (/Windows NT/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Apple Mac';
  if (/Linux/i.test(ua)) return 'Linux Workstation';
  return 'Web Device';
}

export async function collectDeviceTelemetry(): Promise<DeviceTelemetry> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: {mobile?: boolean; platform?: string};
    connection?: {effectiveType?: string};
    getBattery?: () => Promise<{level: number; charging: boolean}>;
  };

  const ua = nav.userAgent || '';
  const isMobile =
    Boolean(nav.userAgentData?.mobile) ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (nav.maxTouchPoints > 1 && window.screen.width < 1024);

  const [estimatedRefreshHz, battery] = await Promise.all([
    estimateRefreshHz(),
    (async () => {
      try {
        if (!nav.getBattery) return null;
        return await nav.getBattery();
      } catch {
        return null;
      }
    })(),
  ]);

  return {
    platform: nav.userAgentData?.platform || nav.platform || 'Unknown',
    userAgent: ua,
    isMobile,
    deviceModelHint: detectDeviceModelHint(ua),
    ramGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cpuCores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
    devicePixelRatio: Number((window.devicePixelRatio || 1).toFixed(2)),
    estimatedRefreshHz,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    gpuRenderer: getGpuRenderer(),
    networkType: nav.connection?.effectiveType || 'unknown',
    batteryPercent: battery ? Math.round(battery.level * 100) : null,
    batteryCharging: battery ? battery.charging : null,
  };
}

export async function captureScreenFrameDataUrl(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser. Upload a screenshot instead.');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => window.setTimeout(r, 150));

    const srcW = video.videoWidth || 1280;
    const srcH = video.videoHeight || 720;
    const scale = Math.min(1, 1280 / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to read captured screen frame.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
