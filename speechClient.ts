import type {PrimeSettings} from '../types/prime.ts';
import {attachOutputAudioElement, triggerVoicePulse} from './audioAnalyser.ts';

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let detachAnalyser: (() => void) | null = null;

export function sanitizeForBrowserSpeech(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?```/g, ' I have displayed the code snippet on your screen. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stopAllSpeech(): void {
  if (detachAnalyser) {
    detachAnalyser();
    detachAnalyser = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const all = window.speechSynthesis.getVoices();
  return all
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .concat(all.filter((v) => !v.lang.toLowerCase().startsWith('en')))
    .slice(0, 24);
}

function speakWithBrowserSynthesis(
  cleanText: string,
  settings: Pick<PrimeSettings, 'devicePitch' | 'deviceSpeechRate' | 'deviceVoiceName'>,
  callbacks: {onStart?: () => void; onEnd?: () => void},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voices = window.speechSynthesis.getVoices();
  if (settings.deviceVoiceName) {
    const match = voices.find((v) => v.name === settings.deviceVoiceName);
    if (match) utterance.voice = match;
  }
  utterance.pitch = Math.min(1.5, Math.max(0.6, settings.devicePitch || 1.0));
  utterance.rate = Math.min(1.5, Math.max(0.6, settings.deviceSpeechRate || 1.0));
  utterance.onstart = () => {
    triggerVoicePulse(0.85);
    callbacks.onStart?.();
  };
  utterance.onboundary = () => triggerVoicePulse(0.9);
  utterance.onend = () => callbacks.onEnd?.();
  utterance.onerror = () => callbacks.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export async function speakWithPrimeVoice(
  rawText: string,
  settings: PrimeSettings,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (msg: string) => void;
    styleOverride?: string;
  } = {},
): Promise<void> {
  const cleanText = sanitizeForBrowserSpeech(rawText);
  if (!cleanText) return;

  stopAllSpeech();

  if (settings.voiceEngine === 'device_tts') {
    speakWithBrowserSynthesis(cleanText, settings, callbacks);
    return;
  }

  try {
    callbacks.onStart?.();
    const res = await fetch('/api/prime/tts', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        text: cleanText,
        voiceName: settings.geminiVoicePersona,
        vocalStyle: settings.vocalStyle,
        emotionStyleOverride: callbacks.styleOverride,
        voiceDesignPrompt: settings.voiceDesignPrompt,
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as {error?: string};
      throw new Error(errData.error || 'Neural TTS failed');
    }

    const data = (await res.json()) as {audioBase64: string; mimeType: string};
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {type: data.mimeType || 'audio/wav'});
    const url = URL.createObjectURL(blob);
    activeObjectUrl = url;

    const audio = new Audio(url);
    activeAudio = audio;
    detachAnalyser = attachOutputAudioElement(audio);
    audio.onended = () => {
      stopAllSpeech();
      callbacks.onEnd?.();
    };
    audio.onerror = () => {
      stopAllSpeech();
      speakWithBrowserSynthesis(cleanText, settings, callbacks);
    };
    await audio.play();
  } catch (err) {
    // Fallback smoothly to browser speech synthesis so voice output remains reliable
    if (err instanceof Error && err.message.includes('GEMINI_API_KEY')) {
      callbacks.onError?.(err.message);
    }
    speakWithBrowserSynthesis(cleanText, settings, callbacks);
  }
}
