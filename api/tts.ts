import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

// Proxies Google Translate TTS, stripping browser headers that cause 404s.
export default function handler(req: VercelRequest, res: VercelResponse) {
  const query = new URLSearchParams(req.query as Record<string, string>).toString();
  const url = `https://translate.google.com/translate_tts?${query}`;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'Accept': '*/*',
    },
  };

  https.get(url, options, (upstream) => {
    res.setHeader('Content-Type', upstream.headers['content-type'] ?? 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.pipe(res);
  }).on('error', () => res.status(502).end());
}
