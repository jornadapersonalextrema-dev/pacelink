import React from 'react';

type TopbarProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

export const Topbar: React.FC<TopbarProps> = ({ title, showBack, onBack, rightSlot }) => {
  return (
    <div className="w-full bg-[#d1d1d1]">
      <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar"
              className="text-white/90 hover:text-white"
            >
              <span className="text-2xl leading-none">‹</span>
            </button>
          ) : null}

          <div className="text-white text-xl font-semibold truncate">
            {title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot ?? null}
        </div>
      </div>
    </div>
  );
};

// Compatibilidade: permite `import Topbar from '...'`
export default Topbar;
