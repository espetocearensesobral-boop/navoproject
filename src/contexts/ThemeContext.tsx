import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/api';

export type ThemeMode = 'dark' | 'light';

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
  | 'slate'
  | 'amber'
  | 'teal'
  | 'indigo'
  | 'crimson'
  | 'bronze'
  | 'violet'
  | 'champagne'
  | 'mint'
  | 'coral'
  | 'titanium'
  | 'cobalt'
  | 'jade'
  | 'sand'
  | 'plum'
  | 'electric'
  | 'sage'
  | 'terracotta'
  | 'midnight'
  | 'lavender'
  | 'bordeaux';

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
  { id: 'ocean', name: 'Azul Oceano', description: 'Calma e precisão', accent: '#22B8CF', accentSoft: '#67DCEB', deep: '#006A78' },
  { id: 'copper', name: 'Cobre Artesanal', description: 'Quente e tradicional', accent: '#D88952', accentSoft: '#F0B184', deep: '#A55225' },
  { id: 'rose', name: 'Rosé Gold', description: 'Estilo e elegância suave', accent: '#E779A9', accentSoft: '#F5A9C8', deep: '#B6497B' },
  { id: 'olive', name: 'Verde Oliva', description: 'Discreto e atemporal', accent: '#A3B18A', accentSoft: '#C7D2A9', deep: '#5E6E45' },
  { id: 'slate', name: 'Cinza Platina', description: 'Minimalismo contemporâneo', accent: '#94A3B8', accentSoft: '#C2CCD8', deep: '#5E6D82' },
  { id: 'amber', name: 'Âmbar Solar', description: 'Quente e vívido', accent: '#F59E0B', accentSoft: '#FCD34D', deep: '#B45309' },
  { id: 'teal', name: 'Turquesa Mística', description: 'Moderna e envolvente', accent: '#14B8A6', accentSoft: '#5EEAD4', deep: '#0F766E' },
  { id: 'indigo', name: 'Índigo Profundo', description: 'Nobre e marcante', accent: '#5B5EEB', accentSoft: '#A5B4FC', deep: '#4338CA' },
  { id: 'crimson', name: 'Carmim Real', description: 'Intenso e elegante', accent: '#E11D48', accentSoft: '#FDA4AF', deep: '#9F1239' },
  { id: 'bronze', name: 'Bronze Clássico', description: 'Rústico e valioso', accent: '#C07A46', accentSoft: '#E4B28C', deep: '#8A4F23' },
  { id: 'violet', name: 'Violeta Imperial', description: 'Exclusivo e luxuoso', accent: '#8B5CF6', accentSoft: '#DDD6FE', deep: '#6D28D9' },
  { id: 'champagne', name: 'Champagne Nude', description: 'Requintado e minimalista', accent: '#D4B996', accentSoft: '#E8D7C3', deep: '#705539' },
  { id: 'mint', name: 'Menta Ice', description: 'Refrescante e contemporâneo', accent: '#10B981', accentSoft: '#6EE7B7', deep: '#047857' },
  { id: 'coral', name: 'Coral Sunset', description: 'Vibrante e caloroso', accent: '#F97316', accentSoft: '#FDBA74', deep: '#C2410C' },
  { id: 'titanium', name: 'Titânio Grafite', description: 'Sóbrio e urbano', accent: '#64748B', accentSoft: '#CBD5E1', deep: '#334155' },
  { id: 'cobalt', name: 'Azul Cobalto', description: 'Intenso, magnético e sofisticado', accent: '#2563EB', accentSoft: '#60A5FA', deep: '#1D4ED8' },
  { id: 'jade', name: 'Jade Imperial', description: 'Exótico, vibrante e refinado', accent: '#059669', accentSoft: '#6EE7B7', deep: '#047857' },
  { id: 'sand', name: 'Duna Dourada', description: 'Quente e terroso', accent: '#D97706', accentSoft: '#FBBF24', deep: '#92400E' },
  { id: 'plum', name: 'Ameixa Velvet', description: 'Rico e aveludado', accent: '#A855F7', accentSoft: '#D8B4FE', deep: '#7E22CE' },
  { id: 'electric', name: 'Azul Elétrico', description: 'Neon moderno e dinâmico', accent: '#06B6D4', accentSoft: '#67E8F9', deep: '#00748C' },
  { id: 'sage', name: 'Sálvia Botânica', description: 'Suave e ecorresponsável', accent: '#84A98C', accentSoft: '#CAD2C5', deep: '#46675E' },
  { id: 'terracotta', name: 'Terracota Argila', description: 'Artesanal e caloroso', accent: '#E07A5F', accentSoft: '#F2CC8F', deep: '#B35338' },
  { id: 'midnight', name: 'Azul Meia-Noite', description: 'Profundo e majestoso', accent: '#3B82F6', accentSoft: '#93C5FD', deep: '#1D4ED8' },
  { id: 'lavender', name: 'Lavanda Suave', description: 'Delicada e contemporânea', accent: '#C084FC', accentSoft: '#E9D5FF', deep: '#9333EA' },
  { id: 'bordeaux', name: 'Vinho Bordô', description: 'Elegante e encorpado', accent: '#F43F5E', accentSoft: '#FECDD3', deep: '#BE123C' },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, targetScope?: 'client' | 'admin') => void;
  clientTheme: ThemeMode;
  setClientTheme: (theme: ThemeMode) => void;
  adminTheme: ThemeMode;
  setAdminTheme: (theme: ThemeMode) => void;
  scope: 'client' | 'admin';
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  paletteDefinition: PaletteItem;
}

const STORAGE_KEY = 'navo_theme_palette';
const CLIENT_THEME_KEY = 'navo_theme_mode_client';
const ADMIN_THEME_KEY = 'navo_theme_mode_admin';
const LEGACY_THEME_KEY = 'navo_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  clientTheme: 'dark',
  setClientTheme: () => {},
  adminTheme: 'dark',
  setAdminTheme: () => {},
  scope: 'client',
  palette: 'heritage',
  setPalette: () => {},
  paletteDefinition: PALETTES[0],
});

function getScopeFromPath(): 'admin' | 'client' {
  if (typeof window === 'undefined') return 'client';
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'client';
}

function getInitialClientTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(CLIENT_THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'dark';
}

function getInitialAdminTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(ADMIN_THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'dark';
}

function getInitialPalette(): ThemePalette {
  if (typeof window === 'undefined') return 'heritage';
  const saved = localStorage.getItem(STORAGE_KEY) as ThemePalette | null;
  return PALETTES.some((item) => item.id === saved) ? saved! : 'heritage';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scope, setScope] = useState<'admin' | 'client'>(getScopeFromPath);
  const [clientTheme, setClientThemeState] = useState<ThemeMode>(getInitialClientTheme);
  const [adminTheme, setAdminThemeState] = useState<ThemeMode>(getInitialAdminTheme);
  const [palette, setPaletteState] = useState<ThemePalette>(getInitialPalette);
  const hasUserChangedPalette = useRef(false);

  // Synchronize route scope on location changes
  useEffect(() => {
    const handleLocationChange = () => {
      setScope(getScopeFromPath());
    };

    window.addEventListener('popstate', handleLocationChange);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Update DOM attribute data-theme according to current scope
  useEffect(() => {
    const activeTheme = scope === 'admin' ? adminTheme : clientTheme;
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = `only ${activeTheme}`;

    const colorSchemeMeta = document.getElementById('pwa-color-scheme');
    if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', activeTheme);
    const themeColorMeta = document.getElementById('pwa-theme-color');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', activeTheme === 'light' ? '#F5F5F2' : scope === 'admin' ? '#10131A' : '#0A0A0A');
    }

    if (palette && palette !== 'heritage') {
      document.documentElement.setAttribute('data-palette', palette);
    } else {
      document.documentElement.removeAttribute('data-palette');
    }
    localStorage.setItem(STORAGE_KEY, palette);
  }, [scope, clientTheme, adminTheme, palette]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/preferences/theme', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
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

  const setClientTheme = (nextTheme: ThemeMode) => {
    setClientThemeState(nextTheme);
    localStorage.setItem(CLIENT_THEME_KEY, nextTheme);
  };

  const setAdminTheme = (nextTheme: ThemeMode) => {
    setAdminThemeState(nextTheme);
    localStorage.setItem(ADMIN_THEME_KEY, nextTheme);
  };

  const setTheme = (nextTheme: ThemeMode, targetScope?: 'client' | 'admin') => {
    const target = targetScope || scope;
    if (target === 'admin') {
      setAdminTheme(nextTheme);
    } else {
      setClientTheme(nextTheme);
    }
  };

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

  const currentTheme = scope === 'admin' ? adminTheme : clientTheme;
  const paletteDefinition = PALETTES.find((item) => item.id === palette) || PALETTES[0];

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        setTheme,
        clientTheme,
        setClientTheme,
        adminTheme,
        setAdminTheme,
        scope,
        palette,
        setPalette,
        paletteDefinition,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
