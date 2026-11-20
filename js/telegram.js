/* Telegram Mini App bridge. Safe to load outside Telegram: every call is guarded. */
(function () {
  'use strict';
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTG = !!(tg && tg.platform && tg.platform !== 'unknown');
  var root = document.documentElement;

  function px(n) { return (Number(n) || 0) + 'px'; }

  function applyTheme() {
    if (!inTG) {
      // Normal browser: follow the system colour scheme.
      var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      root.dataset.theme = mq && mq.matches ? 'dark' : 'light';
      return;
    }
    var p = tg.themeParams || {}, st = root.style;
    var map = {
      '--tg-bg': p.bg_color, '--tg-card': p.secondary_bg_color, '--tg-ink': p.text_color,
      '--tg-mute': p.hint_color, '--tg-btn': p.button_color, '--tg-btn-ink': p.button_text_color
    };
    Object.keys(map).forEach(function (k) { if (map[k]) st.setProperty(k, map[k]); });
    root.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
    try { if (p.bg_color) { tg.setHeaderColor(p.bg_color); tg.setBackgroundColor(p.bg_color); } } catch (e) {}
  }

  function applyViewport() {
    if (!inTG) return;
    var h = tg.viewportStableHeight || tg.viewportHeight;
    if (h) root.style.setProperty('--app-h', h + 'px');
  }

  function applySafeArea() {
    if (!inTG) return;
    var a = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
    root.style.setProperty('--tg-safe-t', px((a.top || 0) + (c.top || 0)));
    root.style.setProperty('--tg-safe-b', px((a.bottom || 0) + (c.bottom || 0)));
  }

  var backHandler = null;
  var TG = {
    inTelegram: inTG,
    init: function () {
      applyTheme(); applyViewport(); applySafeArea();
      if (!inTG) {
        var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
        return;
      }
      try { tg.ready(); } catch (e) {}
      try { tg.expand(); } catch (e) {}
      try { tg.onEvent('themeChanged', applyTheme); } catch (e) {}
      try { tg.onEvent('viewportChanged', applyViewport); } catch (e) {}
      try { tg.onEvent('safeAreaChanged', applySafeArea); tg.onEvent('contentSafeAreaChanged', applySafeArea); } catch (e) {}
    },
    // Telegram's own Back button (only exists inside Telegram).
    setBack: function (visible, handler) {
      if (!inTG || !tg.BackButton) return;
      try {
        if (backHandler) tg.BackButton.offClick(backHandler);
        backHandler = visible ? handler : null;
        if (visible) { tg.BackButton.onClick(handler); tg.BackButton.show(); } else tg.BackButton.hide();
      } catch (e) {}
    },
    // Stop swipe-down-to-close while studying cards (Bot API 7.7+).
    lockSwipes: function (on) {
      if (!inTG) return;
      try { on ? tg.disableVerticalSwipes() : tg.enableVerticalSwipes(); } catch (e) {}
    },
    haptic: function (kind) {
      if (!inTG || !tg.HapticFeedback) return;
      try {
        if (kind === 'success' || kind === 'warning' || kind === 'error') tg.HapticFeedback.notificationOccurred(kind);
        else tg.HapticFeedback.impactOccurred(kind || 'light');
      } catch (e) {}
    }
  };
  window.TG = TG;
})();
