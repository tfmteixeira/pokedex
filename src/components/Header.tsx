import { Link } from 'react-router-dom';
import { UI } from '../i18n/ui';

export function Header() {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/pokeball.svg"
            alt=""
            className="w-10 h-10 group-hover:animate-spin"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-2xl sm:text-3xl font-bold tracking-wide">
              {UI.appTitle}
            </span>
            <span className="text-xs sm:text-sm opacity-90">{UI.appSubtitle}</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
