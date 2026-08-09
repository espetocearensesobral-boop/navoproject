import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/api';

export type ThemePalette =
  | 'heritage'
  | 'sapphire'
  | 'emerald'
  | 'amethyst'
  | 'ruby'
  | 'ocean'
  | 'copper'
  | 'rose'
  | 'olive'
  | 'slate';

export interface PaletteItem {
  id: ThemePalette;
  name: string;
  description: string;
  accent: string;
  accentSoft: string;
  deep: string;
}

export const PALETTES: PaletteItem[] = [
  { id: 'heritage', name: 'Dourado Heritage', description: 'Padrão original refinado', accent: '#C8A96A', accentSoft: '#E5CD9A', deep: '#8F7138' },
  { id: 'sapphire', name: 'Azul Safira', description: 'Elegância e modernidade', accent: '#5B8DEF', accentSoft: '#9DBBFF', deep: '#315FBA' },
  { id: 'emerald', name: 'Verde Esmeralda', description: 'Nobreza e frescor', accent: '#35B779', accentSoft: '#7DDBAA', deep: '#168052' },
  { id: 'amethyst', name: 'Roxo Ametista', description: 'Sofisticação e distinção', accent: '#A78BFA', accentSoft: '#C4B5FD', deep: '#7658D4' },
  { id: 'ruby', name: 'Vermelho Rubi', description: 'Impacto e personalidade', accent: '#EF6B73', accentSoft: '#FF9AA0', deep: '#B83D49' },
  { id: 'ocean', name: 'Azul Oceano', description: 'Calma e precisão', accent: '#22B8CF', accentSoft: '#67DCEB', deep: '#087F92' },
  { id: 'copper', name: 'Cobre Artesanal', description: 'Quente e tradicional', accent: '#D88952', accentSoft: '#F0B184', deep: '#A55225' },
  { id: 'rose', name: 'Rosé Gold', description: 'Estilo e elegância suave', accent: '#E779A9', accentSoft: '#F5A9C8', deep: '#B6497B' },
  { id: 'olive', name: 'Verde Oliva', description: 'Discreto e atemporal', accent: '#A3B18A', accentSoft: '#C7D2A9', deep: '#68764F' },
  { id: 'slate', name: 'Cinza Platina', description: 'Minimalismo contemporâneo', accent: '#94A3B8', accentSoft: '#C2CCD8', deep: '#5E6D82' },
];

interface ThemeContextType {
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  paletteDefinition: PaletteItem;
}

const STORAGE_KEY = 'navo_theme_palette';

const ThemeContext = createContext<ThemeContextType>({
  palette: 'heritage',
  setPalette: () => {},
  paletteDefinition: PALETTES[0],
});

function getInitialPalette(): ThemePalette {
  if (typeof window === 'undefined') return 'heritage';
  const saved = localStorage.getItem(STORAGE_KEY) as ThemePalette | null;
  return PALETTES.some((item) => item.id === saved) ? saved! : 'heritage';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [palette, setPaletteState] = useState<ThemePalette>(getInitialPalette);
  const hasUserChangedPalette = useRef(false);

  useEffect(() => {
    if (palette && palette !== 'heritage') {
      document.documentElement.setAttribute('data-palette', palette);
    } else {
      document.documentElement.removeAttribute('data-palette');
    }
    localStorage.setItem(STORAGE_KEY, palette);
  }, [palette]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/preferences/theme', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return PALETTES.some((item) => item.id === data?.palette) ? (data.palette as ThemePalette) : null;
      })
      .then((remotePalette) => {
        if (!cancelled && remotePalette && !hasUserChangedPalette.current) {
          setPaletteState(remotePalette);
        }
      })
      .catch(() => {
        // Fallback para usuários não autenticados ou sem sincronização
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setPalette = (nextPalette: ThemePalette) => {
    hasUserChangedPalette.current = true;
    setPaletteState(nextPalette);

    void authFetch('/api/preferences/theme', {
      method: 'PUT',
      body: JSON.stringify({ palette: nextPalette }),
    }).catch(() => {
      // Valor local salvo no localStorage permanece disponível
    });
  };

  const paletteDefinition = PALETTES.find((item) => item.id === palette) || PALETTES[0];

  return (
    <ThemeContext.Provider value={{ palette, setPalette, paletteDefinition }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
