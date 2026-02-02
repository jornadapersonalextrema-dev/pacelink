import React from 'react';

export type TopbarProps = {
  /** Título exibido no topo (opcional para evitar quebrar builds). */
  title?: string;

  /** Exibe botão de voltar. */
  showBack?: boolean;

  /** Callback do botão voltar. Se não informado, o botão não faz nada. */
  onBack?: () => void;

  /**
   * Slot à direita (versão "nova").
   * Ex.: botões, ícones, menu.
   */
  rightSlot?: React.ReactNode;

  /**
   * Slot à direita (compatibilidade com código antigo).
   * Alguns lugares do projeto usam <Topbar action={...} />
   */
  action?: React.ReactNode;

  /** Permite customizar o container sem editar o componente. */
  className?: string;
};

export const Topbar: React.FC<TopbarProps> = ({
  title = 'PaceLink',
  showBack = false,
  onBack,
  rightSlot,
  action,
  className = '',
}) => {
  const right = rightSlot ?? action ?? null;

  return (
    <div className={`w-full bg-[#d1d1d1] ${className}`}>
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
          {right}
        </div>
      </div>
    </div>
  );
};

// Compatibilidade: permite `import Topbar from '...'`
export default Topbar;
