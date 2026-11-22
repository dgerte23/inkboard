/* InkBoard · 通用工具函数 */
(function (global) {
  'use strict';
  const IB = (global.IB = global.IB || {});
  const U = {};

  U.uid = function (prefix) {
    return (prefix || 'o') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  };

  U.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  U.pad2 = function (n) {
    return String(n).padStart(2, '0');
  };

  U.hexToRgb = function (hex) {
    if (typeof hex !== 'string') return [0, 0, 0];
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  };

  U.rgbToHex = function (r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0');
    }).join('');
  };

  U.normalizeHex = function (value) {
    if (typeof value !== 'string') return null;
    let v = value.trim();
    if (!v) return null;
    if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{3}$/i.test(v)) {
      v = '#' + v.slice(1).split('').map(function (c) { return c + c; }).join('');
    }
    return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
  };

  U.shade = function (hex, amount) {
    const rgb = U.hexToRgb(hex);
    const target = amount >= 0 ? 255 : 0;
    const p = Math.min(1, Math.abs(amount));
    return U.rgbToHex(
      rgb[0] + (target - rgb[0]) * p,
      rgb[1] + (target - rgb[1]) * p,
      rgb[2] + (target - rgb[2]) * p
    );
  };

  U.alpha = function (hex, alpha) {
    const rgb = U.hexToRgb(hex);
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + U.clamp(alpha, 0, 1) + ')';
  };

  U.luminance = function (hex) {
    const rgb = U.hexToRgb(hex).map(function (v) {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  U.contrastText = function (hex) {
    return U.luminance(hex) > 0.48 ? '#101828' : '#ffffff';
  };

  U.debounce = function (fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  };

  U.clone = function (value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return value;
    }
  };

  U.escapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.download = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };

  U.safeFilename = function (name, fallback) {
    const cleaned = String(name || '').replace(/[\\/:*?"<>|\r\n]+/g, '_').replace(/\s+/g, ' ').trim();
    return cleaned || fallback || 'inkboard';
  };

  U.formatClock = function (date, use24, showSeconds) {
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    let hours = date.getHours();
    let suffix = '';
    if (!use24) {
      suffix = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12 || 12;
    }
    let time = U.pad2(hours) + ':' + U.pad2(date.getMinutes());
    if (showSeconds) time += ':' + U.pad2(date.getSeconds());
    if (!use24) time += suffix;
    const day = date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
    return {
      time: time,
      date: day + ' · 周' + week[date.getDay()]
    };
  };

  U.formatDuration = function (ms, forceHours) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0 || forceHours) return U.pad2(h) + ':' + U.pad2(m) + ':' + U.pad2(s);
    return U.pad2(m) + ':' + U.pad2(s);
  };

  U.formatDateTime = function (ts) {
    const d = new Date(ts);
    return U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate()) + ' ' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
  };

  U.formatFileTime = function (date) {
    const d = date || new Date();
    return d.getFullYear() + U.pad2(d.getMonth() + 1) + U.pad2(d.getDate()) + '-' + U.pad2(d.getHours()) + U.pad2(d.getMinutes());
  };

  U.pointSegmentDistance = function (px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = U.clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  U.rectsIntersect = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  U.pointInRect = function (x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };

  U.todayLabel = function () {
    const d = new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };

  IB.util = U;
})(window);
