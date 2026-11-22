/* InkBoard · 本地存储（设置 / 调色板 / 自动缓存 / 快照） */
(function (global) {
  'use strict';
  const IB = (global.IB = global.IB || {});
  const U = IB.util;
  const Store = {};
  const PREFIX = 'inkboard.v1.';
  const KEYS = {
    settings: PREFIX + 'settings',
    palette: PREFIX + 'palette',
    doc: PREFIX + 'doc',
    saves: PREFIX + 'saves'
  };

  Store.KEYS = KEYS;

  Store.DEFAULT_SETTINGS = {
    themeColor: '#4f46e5',
    dark: false,
    clock24: true,
    showSeconds: false,
    sound: true,
    autosave: true,
    showFloatingTimer: false,
    color: '#1f2937',
    width: 4,
    textSize: 32,
    fill: false,
    countdownMs: 25 * 60 * 1000
  };

  Store.DEFAULT_BOARD = {
    w: 1600,
    h: 1000,
    bg: '#fdfdfb',
    pattern: 'dots'
  };

  Store.BUILTIN_FOLDERS = [
    {
      id: 'builtin-basic',
      name: '基础色',
      colors: ['#111827', '#475569', '#94a3b8', '#e2e8f0', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#78350f', '#000000']
    },
    {
      id: 'builtin-morandi',
      name: '莫兰迪',
      colors: ['#A8B5A2', '#C9B8A8', '#D8C3A5', '#B7A99A', '#8E9AAF', '#A9BCD0', '#C6B8CF', '#D4A5A5', '#9CAF9F', '#BFA58A', '#7D8CA3', '#E3D5CA']
    },
    {
      id: 'builtin-candy',
      name: '糖果色',
      colors: ['#FFB3C1', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFADAD', '#F1C0E8', '#FFDAC1', '#B5EAD7']
    },
    {
      id: 'builtin-neon',
      name: '霓虹',
      colors: ['#00F5D4', '#00BBF9', '#FEE440', '#F15BB5', '#9B5DE5', '#FF006E', '#3A86FF', '#8338EC', '#FB5607', '#06D6A0']
    },
    {
      id: 'builtin-earth',
      name: '大地',
      colors: ['#6B4F3A', '#8D6E4A', '#A98467', '#C4A484', '#D9C1A3', '#E8D8C3', '#4F5D4E', '#7A8B6F', '#B4C4A8', '#3E4A3D', '#5C4033', '#D2B48C']
    }
  ];

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  Store.loadSettings = function () {
    const saved = read(KEYS.settings, {}) || {};
    const out = Object.assign({}, Store.DEFAULT_SETTINGS, saved);
    if (!U.normalizeHex(out.themeColor)) out.themeColor = Store.DEFAULT_SETTINGS.themeColor;
    if (!U.normalizeHex(out.color)) out.color = Store.DEFAULT_SETTINGS.color;
    out.width = U.clamp(Number(out.width) || 4, 1, 40);
    out.textSize = U.clamp(Number(out.textSize) || 32, 12, 120);
    out.countdownMs = U.clamp(Number(out.countdownMs) || 25 * 60000, 1000, 24 * 3600 * 1000);
    out.dark = !!out.dark;
    out.clock24 = out.clock24 !== false;
    out.showSeconds = !!out.showSeconds;
    out.sound = out.sound !== false;
    out.autosave = out.autosave !== false;
    out.showFloatingTimer = !!out.showFloatingTimer;
    out.fill = !!out.fill;
    return out;
  };

  Store.saveSettings = function (settings) {
    return write(KEYS.settings, settings);
  };

  Store.loadPalette = function () {
    const saved = read(KEYS.palette, null);
    const palette = { recent: [], folders: [] };
    if (saved && typeof saved === 'object') {
      if (Array.isArray(saved.recent)) {
        palette.recent = saved.recent.filter(function (c) { return !!U.normalizeHex(c); }).slice(0, 18);
      }
      if (Array.isArray(saved.folders)) {
        palette.folders = saved.folders.filter(function (f) {
          return f && typeof f.id === 'string' && typeof f.name === 'string' && Array.isArray(f.colors);
        }).map(function (f) {
          return {
            id: f.id,
            name: f.name,
            colors: f.colors.filter(function (c) { return !!U.normalizeHex(c); })
          };
        });
      }
    }
    if (!saved) {
      palette.folders = [{
        id: 'folder-favorites',
        name: '我的收藏',
        colors: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444']
      }];
    }
    return palette;
  };

  Store.savePalette = function (palette) {
    return write(KEYS.palette, palette);
  };

  Store.loadSaves = function () {
    const list = read(KEYS.saves, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && Array.isArray(item.objects) && item.board;
    }).slice(0, 40);
  };

  Store.saveSaves = function (saves) {
    return write(KEYS.saves, saves.slice(0, 40));
  };

  Store.normalizeBoard = function (board) {
    const fallback = Store.DEFAULT_BOARD;
    const b = board && typeof board === 'object' ? board : {};
    return {
      w: Math.round(U.clamp(Number(b.w) || fallback.w, 320, 4000)),
      h: Math.round(U.clamp(Number(b.h) || fallback.h, 240, 4000)),
      bg: U.normalizeHex(b.bg) || fallback.bg,
      pattern: ['none', 'dots', 'grid', 'lines'].indexOf(b.pattern) >= 0 ? b.pattern : fallback.pattern
    };
  };

  Store.loadDoc = function () {
    const doc = read(KEYS.doc, null);
    if (!doc || !Array.isArray(doc.objects)) return null;
    return {
      version: 1,
      title: typeof doc.title === 'string' ? doc.title : '未命名白板',
      board: Store.normalizeBoard(doc.board),
      objects: doc.objects.filter(function (o) { return o && typeof o.type === 'string'; }),
      savedAt: doc.savedAt || null
    };
  };

  Store.saveDoc = function (doc) {
    return write(KEYS.doc, doc);
  };

  Store.clearDoc = function () {
    try {
      localStorage.removeItem(KEYS.doc);
      return true;
    } catch (err) {
      return false;
    }
  };

  IB.store = Store;
})(window);
