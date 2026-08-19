(() => {
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && (args[0].includes('lazy') || args[0].includes('Intervention'))) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  const applyBootstrapState = () => {
    const isAdmin = window.location.pathname.indexOf('/admin') === 0;
    const identity = isAdmin
      ? {
          manifest: '/manifest-admin.json',
          title: 'Administrativo',
          icon: '/pwa-admin-192x192.svg',
          themeColor: '#10131A',
        }
      : {
          manifest: '/manifest.json',
          title: 'Agendamentos',
          icon: '/pwa-192x192.svg',
          themeColor: '#0A0A0A',
        };

    const manifest = document.getElementById('pwa-manifest');
    const themeColor = document.getElementById('pwa-theme-color');
    const appleTitle = document.getElementById('pwa-apple-title');
    const appleIcon = document.getElementById('pwa-apple-icon');
    const favicon = document.getElementById('pwa-favicon');

    manifest?.setAttribute('href', identity.manifest);
    themeColor?.setAttribute('content', identity.themeColor);
    appleTitle?.setAttribute('content', identity.title);
    appleIcon?.setAttribute('href', identity.icon);
    favicon?.setAttribute('href', identity.icon);
  };

  try {
    const isAdmin = window.location.pathname.indexOf('/admin') === 0;
    const themeKey = isAdmin ? 'navo_theme_mode_admin' : 'navo_theme_mode_client';
    const saved = localStorage.getItem(themeKey) || localStorage.getItem('navo_theme_mode');
    const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = `only ${theme}`;
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'only dark';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBootstrapState, { once: true });
  } else {
    applyBootstrapState();
  }
})();
