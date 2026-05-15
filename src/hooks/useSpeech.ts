import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Text-to-speech hook using Google Translate's TTS endpoint, proxied through
 * the Vite dev server (see vite.config.ts) to avoid Chrome's Opaque Response
 * Blocking and Google's referer-based 404s.
 *
 * Accepts either a plain string (read in pt-PT) or an array of segments with
 * per-segment language. This lets us pronounce Pokémon names in en-US (which
 * matches their etymology — Charizard, Squirtle, etc.) while keeping the
 * description and surrounding text in pt-PT.
 *
 * Falls back to the browser SpeechSynthesis if the network call fails.
 */
export type SpeechLang = 'pt-PT' | 'en-US';
export interface SpeechSegment {
  text: string;
  lang: SpeechLang;
}
export type SpeechInput = string | SpeechSegment[];

const TTS_URL = '/tts';
const MAX_CHUNK = 180; // bytes (UTF-8) — Google TTS limit is ~200, keep margin

interface AudioChunk { text: string; lang: SpeechLang }

function encodedLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

function splitSegment(segment: SpeechSegment): AudioChunk[] {
  const cleaned = segment.text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?:])\s+/);
  const chunks: AudioChunk[] = [];
  let buf = '';
  const flush = () => { if (buf) { chunks.push({ text: buf.trim(), lang: segment.lang }); buf = ''; } };
  for (const s of sentences) {
    if (encodedLen(buf + ' ' + s) <= MAX_CHUNK) {
      buf = buf ? `${buf} ${s}` : s;
    } else {
      flush();
      if (encodedLen(s) <= MAX_CHUNK) {
        buf = s;
      } else {
        for (const part of s.split(/(?<=,)\s+|\s+/)) {
          if (encodedLen(buf + ' ' + part) <= MAX_CHUNK) {
            buf = buf ? `${buf} ${part}` : part;
          } else {
            flush();
            buf = part;
          }
        }
      }
    }
  }
  flush();
  return chunks;
}

function normalizeInput(input: SpeechInput): SpeechSegment[] {
  if (typeof input === 'string') return [{ text: input, lang: 'pt-PT' }];
  return input;
}

function buildChunks(input: SpeechInput): AudioChunk[] {
  return normalizeInput(input).flatMap(splitSegment);
}

function ttsUrl(chunk: AudioChunk): string {
  return `${TTS_URL}?ie=UTF-8&tl=${chunk.lang}&client=tw-ob&q=${encodeURIComponent(chunk.text)}`;
}

export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const fallbackWebSpeech = useCallback((segments: SpeechSegment[]) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const pickVoice = (lang: SpeechLang) =>
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));

    let i = 0;
    const next = () => {
      if (i >= segments.length) { setSpeaking(false); return; }
      const seg = segments[i++];
      const utt = new SpeechSynthesisUtterance(seg.text);
      utt.lang = seg.lang;
      const v = pickVoice(seg.lang);
      if (v) utt.voice = v;
      utt.onstart = () => setSpeaking(true);
      utt.onend = next;
      utt.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utt);
    };
    next();
  }, []);

  const speak = useCallback((input: SpeechInput) => {
    stop();
    cancelledRef.current = false;
    const segments = normalizeInput(input);
    const chunks = buildChunks(segments);
    if (chunks.length === 0) return;

    setSpeaking(true);

    let index = 0;
    const playNext = () => {
      if (cancelledRef.current) { setSpeaking(false); return; }
      if (index >= chunks.length) { setSpeaking(false); return; }
      const audio = new Audio(ttsUrl(chunks[index]));
      audio.preload = 'auto';
      audioRef.current = audio;
      audio.onended = () => { index++; playNext(); };
      audio.onerror = () => {
        if (index === 0) {
          setSpeaking(false);
          fallbackWebSpeech(segments);
        } else {
          index++;
          playNext();
        }
      };
      audio.play().catch(() => {
        if (index === 0) {
          setSpeaking(false);
          fallbackWebSpeech(segments);
        } else {
          index++;
          playNext();
        }
      });
    };

    playNext();
  }, [stop, fallbackWebSpeech]);

  return { speak, stop, speaking, supported: true };
}
