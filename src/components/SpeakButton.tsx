import { useSpeech } from '../hooks/useSpeech';
import type { SpeechInput } from '../hooks/useSpeech';
import { UI } from '../i18n/ui';

interface Props {
  text: SpeechInput;
  label?: string;
  size?: 'md' | 'lg';
}

export function SpeakButton({ text, label, size = 'md' }: Props) {
  const { speak, stop, speaking, supported } = useSpeech();
  if (!supported) return null;

  const sizeClass =
    size === 'lg' ? 'text-2xl px-8 py-5' : 'text-lg px-6 py-3';

  const hasContent = typeof text === 'string' ? text.length > 0 : text.length > 0;

  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : hasContent && speak(text))}
      className={`inline-flex items-center gap-3 rounded-full font-bold text-white shadow-lg active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-red-200 ${sizeClass} ${
        speaking
          ? 'bg-gradient-to-r from-orange-500 to-red-500 animate-pulse'
          : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
      }`}
      aria-label={label ?? UI.listen}
    >
      <span className="text-2xl" aria-hidden>
        {speaking ? '⏸️' : '🔊'}
      </span>
      <span>{speaking ? UI.stop : (label ?? UI.listen)}</span>
    </button>
  );
}
