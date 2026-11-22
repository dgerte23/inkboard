/* InkBoard · 主程序 */
(function () {
  'use strict';

  const U = IB.util;
  const S = IB.shapes;
  const Store = IB.store;
  const TimerEngine = IB.timer;

  const $ = function (id) { return document.getElementById(id); };

  const dom = {
    docTitle: $('docTitle'),
    saveState: $('saveState'),
    clockTime: $('clockTime'),
    clockDate: $('clockDate'),
    themeModeBtn: $('themeModeBtn'),
    helpBtn: $('helpBtn'),
    topExportBtn: $('topExportBtn'),
    panelToggle: $('panelToggle'),
    viewport: $('viewport'),
    stage: $('stage'),
    canvas: $('board'),
    canvasArea: $('canvasArea'),
    toolHint: $('toolHint'),
    fillToggle: $('fillToggle'),
    canvasHint: $('canvasHint'),
    selectionBar: $('selectionBar'),
    selCount: $('selCount'),
    selDuplicate: $('selDuplicate'),
    selFront: $('selFront'),
    selBack: $('selBack'),
    selDelete: $('selDelete'),
    floatingTimer: $('floatingTimer'),
    ftHead: $('ftHead'),
    floatTimerLabel: $('floatTimerLabel'),
    floatTimerTime: $('floatTimerTime'),
    floatTimerToggle: $('floatTimerToggle'),
    floatTimerReset: $('floatTimerReset'),
    floatTimerClose: $('floatTimerClose'),
    zoomOut: $('zoomOut'),
    zoomIn: $('zoomIn'),
    zoomLabel: $('zoomLabel'),
    zoomFit: $('zoomFit'),
    zoomReset: $('zoomReset'),
    boardMeta: $('boardMeta'),
    shapeBtn: $('shapeBtn'),
    shape3dBtn: $('shape3dBtn'),
    undoBtn: $('undoBtn'),
    redoBtn: $('redoBtn'),
    clearBtn: $('clearBtn'),
    sidepanel: $('sidepanel'),
    panelScroll: $('panelScroll'),
    toolBadge: $('toolBadge'),
    currentChip: $('currentChip'),
    colorInput: $('colorInput'),
    hexInput: $('hexInput'),
    widthRange: $('widthRange'),
    widthValue: $('widthValue'),
    textSizeRange: $('textSizeRange'),
    textSizeValue: $('textSizeValue'),
    recentColors: $('recentColors'),
    clearRecent: $('clearRecent'),
    builtinFolders: $('builtinFolders'),
    userFolders: $('userFolders'),
    newFolderBtn: $('newFolderBtn'),
    boardColorInput: $('boardColorInput'),
    boardPresets: $('boardPresets'),
    patternGroup: $('patternGroup'),
    boardW: $('boardW'),
    boardH: $('boardH'),
    applySize: $('applySize'),
    sizePresets: $('sizePresets'),
    fitBoardBtn: $('fitBoardBtn'),
    boardSizeBadge: $('boardSizeBadge'),
    timerBadge: $('timerBadge'),
    timerMode: $('timerMode'),
    timerCard: $('timerCard'),
    timerSub: $('timerSub'),
    timerDisplay: $('timerDisplay'),
    timerProgress: $('timerProgress'),
    timerStart: $('timerStart'),
    timerReset: $('timerReset'),
    countdownSetup: $('countdownSetup'),
    cdHours: $('cdHours'),
    cdMinutes: $('cdMinutes'),
    cdSeconds: $('cdSeconds'),
    cdPresets: $('cdPresets'),
    applyCountdown: $('applyCountdown'),
    floatingTimerToggle: $('floatingTimerToggle'),
    autosaveCard: $('autosaveCard'),
    autosaveState: $('autosaveState'),
    saveNowBtn: $('saveNowBtn'),
    snapName: $('snapName'),
    saveSnapshotBtn: $('saveSnapshotBtn'),
    savesList: $('savesList'),
    exportPngBtn: $('exportPngBtn'),
    exportJsonBtn: $('exportJsonBtn'),
    importJsonBtn: $('importJsonBtn'),
    importFile: $('importFile'),
    clearBoardBtn2: $('clearBoardBtn2'),
    themeHex: $('themeHex'),
    themePresets: $('themePresets'),
    themeColorInput: $('themeColorInput'),
    darkToggle: $('darkToggle'),
    clock24Toggle: $('clock24Toggle'),
    secondsToggle: $('secondsToggle'),
    soundToggle: $('soundToggle'),
    autosaveToggle: $('autosaveToggle'),
    helpBtn2: $('helpBtn2'),
    resetSettingsBtn: $('resetSettingsBtn'),
    popoverRoot: $('popoverRoot'),
    modalRoot: $('modalRoot'),
    toastRoot: $('toastRoot')
  };

  const ctx = dom.canvas.getContext('2d');
  const settings = Store.loadSettings();
  const restored = Store.loadDoc();

  const state = {
    objects: [],
    selection: new Set(),
    tool: 'pen',
    color: settings.color,
    width: settings.width,
    textSize: settings.textSize,
    fill: settings.fill,
    board: Object.assign({}, Store.DEFAULT_BOARD),
    title: '未命名白板',
    zoom: 1,
    zoomMode: 'fit',
    resScale: 1,
    gesture: null,
    textEditor: null,
    editingId: null,
    eraserPos: null,
    lastTextClick: null,
    pendingTextEdit: null,
    palette: Store.loadPalette(),
    saves: Store.loadSaves(),
    collapsed: new Set(['builtin-morandi', 'builtin-candy', 'builtin-neon', 'builtin-earth']),
    lastSaved: null,
    dirty: false,
    autosaveTimer: null
  };

  if (restored) {
    state.objects = restored.objects.filter(isValidObject);
    state.board = restored.board;
    state.title = restored.title || '未命名白板';
    if (restored.savedAt) {
      const d = new Date(restored.savedAt);
      if (!isNaN(d.getTime())) state.lastSaved = d;
    }
  }

  const history = { past: [], future: [], pending: null };
  let timer = null;
  let rafId = 0;
  let activePopover = null;
  let popoverOutside = null;
  let ftDrag = null;
  let audioCtx = null;
  let measureCanvas = null;
  let bgCache = null;
  let bgCacheKey = '';

  const THEME_PRESETS = ['#4f46e5', '#0ea5e9', '#0d9488', '#16a34a', '#f59e0b', '#f97316', '#e11d48', '#db2777', '#8b5cf6', '#0f172a'];
  const BOARD_PRESETS = ['#fdfdfb', '#ffffff', '#f7f2e8', '#eef7f2', '#eef4ff', '#fff1f2', '#101827'];
  const TOOL_NAMES = { select: '选择', pen: '钢笔', eraser: '橡皮', text: '文字' };

  /* ==========================================================================
     基础工具
     ========================================================================== */

  function icon(name) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function isValidObject(obj) {
    if (!obj || typeof obj.type !== 'string') return false;
    if (obj.type === 'stroke') return Array.isArray(obj.points) && obj.points.length > 0;
    if (obj.type === 'text') return typeof obj.text === 'string';
    return S.isShapeType(obj.type) && isFinite(obj.x1) && isFinite(obj.y1) && isFinite(obj.x2) && isFinite(obj.y2);
  }

  function escapeHtml(value) {
    return U.escapeHtml(value);
  }

  function getMeasureCtx() {
    if (!measureCanvas) {
      measureCanvas = document.createElement('canvas');
    }
    return measureCanvas.getContext('2d');
  }

  function formatShortTime(date) {
    return U.pad2(date.getHours()) + ':' + U.pad2(date.getMinutes());
  }

  function toast(message, type) {
    const kind = type || 'success';
    const el = document.createElement('div');
    el.className = 'toast ' + (kind === 'error' ? 'error' : kind === 'timer' ? 'timer' : '');
    el.innerHTML = icon(kind === 'error' ? 'close' : kind === 'timer' ? 'timer' : 'check') + '<span>' + escapeHtml(message) + '</span>';
    dom.toastRoot.appendChild(el);
    while (dom.toastRoot.children.length > 4) {
      dom.toastRoot.removeChild(dom.toastRoot.firstElementChild);
    }
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 220);
    }, 2600);
  }

  function setSaveState(text, mode) {
    dom.saveState.className = 'save-state' + (mode ? ' ' + mode : '');
    const span = dom.saveState.querySelector('span');
    if (span) span.textContent = text;
  }

  function updateDocumentTitle() {
    document.title = state.title + ' · 墨板 InkBoard';
  }

  /* ==========================================================================
     主题
     ========================================================================== */

  function applyTheme() {
    const root = document.documentElement;
    root.dataset.theme = settings.dark ? 'dark' : 'light';
    const rgb = U.hexToRgb(settings.themeColor).join(',');
    root.style.setProperty('--accent', settings.themeColor);
    root.style.setProperty('--accent-strong', U.shade(settings.themeColor, -0.14));
    root.style.setProperty('--accent-soft', 'rgba(' + rgb + ',' + (settings.dark ? '0.2' : '0.12') + ')');
    root.style.setProperty('--accent-soft-2', 'rgba(' + rgb + ',' + (settings.dark ? '0.34' : '0.2') + ')');
    root.style.setProperty('--accent-contrast', U.contrastText(settings.themeColor));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.dark ? '#090d16' : '#eef1f6');
    dom.themeModeBtn.innerHTML = icon(settings.dark ? 'sun' : 'moon');
    dom.themeModeBtn.title = settings.dark ? '切换到浅色界面' : '切换到深色界面';
    if (dom.darkToggle) dom.darkToggle.checked = settings.dark;
    if (dom.themeHex) dom.themeHex.textContent = settings.themeColor.toUpperCase();
    if (dom.themeColorInput) dom.themeColorInput.value = settings.themeColor;
    renderThemePresets();
  }

  function setThemeColor(value) {
    const hex = U.normalizeHex(value);
    if (!hex) return;
    settings.themeColor = hex;
    Store.saveSettings(settings);
    applyTheme();
    requestRender();
  }

  function renderThemePresets() {
    dom.themePresets.innerHTML = THEME_PRESETS.map(function (color) {
      return '<button class="swatch' + (color === settings.themeColor ? ' active' : '') +
        '" data-theme-color="' + color + '" style="--c:' + color + '" title="' + color + '"></button>';
    }).join('');
    dom.themeHex.textContent = settings.themeColor.toUpperCase();
    dom.themeColorInput.value = settings.themeColor;
  }

  /* ==========================================================================
     通用弹窗
     ========================================================================== */

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
    if (popoverOutside) {
      document.removeEventListener('pointerdown', popoverOutside, true);
      popoverOutside = null;
    }
  }

  function openPopover(popover, anchor, alignRight) {
    closePopover();
    dom.popoverRoot.appendChild(popover);
    const rect = popover.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    let left;
    if (alignRight) left = a.right - rect.width;
    else left = a.right + 10;
    if (left + rect.width > window.innerWidth - 10) left = a.left - rect.width - 10;
    if (left < 10) left = 10;
    let top = a.top;
    if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10;
    if (top < 10) top = 10;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    activePopover = popover;
    setTimeout(function () {
      popoverOutside = function (event) {
        if (activePopover && !activePopover.contains(event.target) && !anchor.contains(event.target)) {
          closePopover();
        }
      };
      document.addEventListener('pointerdown', popoverOutside, true);
    }, 0);
  }

  function openDialog(options) {
    return new Promise(function (resolve) {
      closePopover();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const card = document.createElement('div');
      card.className = 'modal-card' + (options.wide ? ' modal-shortcuts' : '');

      let html = '<h3>' + escapeHtml(options.title) + '</h3>';
      if (options.html) html += options.html;
      else if (options.message) html += '<p>' + escapeHtml(options.message) + '</p>';
      if (options.input) {
        html += '<input class="modal-input" type="text" maxlength="60" placeholder="' +
          escapeHtml(options.placeholder || '') + '" value="' + escapeHtml(options.inputValue || '') + '">';
      }
      html += '<div class="modal-actions"></div>';
      card.innerHTML = html;

      const actions = card.querySelector('.modal-actions');
      let cancelBtn = null;
      if (!options.hideCancel) {
        cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-secondary';
        cancelBtn.textContent = options.cancelLabel || '取消';
        actions.appendChild(cancelBtn);
      }
      const confirmBtn = document.createElement('button');
      confirmBtn.className = options.danger ? 'btn-danger' : 'btn-primary';
      confirmBtn.textContent = options.confirmLabel || '确定';
      actions.appendChild(confirmBtn);
      overlay.appendChild(card);
      dom.modalRoot.appendChild(overlay);

      const input = card.querySelector('.modal-input');
      const close = function (value) {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(value);
      };
      const onKey = function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(options.input ? null : false);
        } else if (event.key === 'Enter' && (!input || document.activeElement === input)) {
          event.preventDefault();
          confirmBtn.click();
        }
      };
      document.addEventListener('keydown', onKey, true);
      if (cancelBtn) cancelBtn.addEventListener('click', function () { close(options.input ? null : false); });
      confirmBtn.addEventListener('click', function () {
        close(options.input ? input.value.trim() : true);
      });
      overlay.addEventListener('pointerdown', function (event) {
        if (event.target === overlay) close(options.input ? null : false);
      });
      if (input) {
        input.focus();
        input.select();
      } else {
        confirmBtn.focus();
      }
    });
  }

  function confirmDialog(title, message, confirmLabel, danger) {
    return openDialog({
      title: title,
      message: message,
      confirmLabel: confirmLabel || '确定',
      danger: !!danger
    }).then(function (value) { return value === true; });
  }

  function promptDialog(title, message, value, placeholder) {
    return openDialog({
      title: title,
      message: message,
      input: true,
      inputValue: value || '',
      placeholder: placeholder || '',
      confirmLabel: '确定'
    });
  }

  function showHelp() {
    const rows = [
      ['V / P / E / T', '选择 / 钢笔 / 橡皮 / 文字'],
      ['鼠标左键拖动', '使用当前工具绘制或框选'],
      ['鼠标右键拖动', '随时用画笔绘制线条'],
      ['Ctrl + Z', '撤销'],
      ['Ctrl + Y / Ctrl + Shift + Z', '重做'],
      ['Delete / Backspace', '删除选中的内容'],
      ['Ctrl + D', '复制选中的内容'],
      ['Ctrl + A', '全选画板内容'],
      ['方向键 / Shift + 方向键', '微移 1px / 10px'],
      ['[ / ]', '置底 / 置顶'],
      ['Ctrl + S', '立即保存到本机'],
      ['Ctrl + 滚轮', '缩放画板'],
      ['Esc', '取消选择 / 关闭弹窗']
    ];
    const html = '<div class="shortcut-table">' + rows.map(function (row) {
      return '<div class="shortcut-line"><span>' + escapeHtml(row[1]) + '</span><span class="keys"><kbd>' +
        escapeHtml(row[0]) + '</kbd></span></div>';
    }).join('') + '</div>';
    openDialog({
      title: '快捷键与操作',
      html: html,
      confirmLabel: '知道了',
      hideCancel: true,
      wide: true
    });
  }

  /* ==========================================================================
     颜色与画笔
     ========================================================================== */

  function setColor(value, remember) {
    const hex = U.normalizeHex(value);
    if (!hex) return;
    state.color = hex;
    settings.color = hex;
    Store.saveSettings(settings);
    dom.colorInput.value = hex;
    dom.hexInput.value = hex.slice(1).toUpperCase();
    dom.currentChip.style.setProperty('--brush', hex);
    syncSwatchActive();
    if (remember !== false) rememberColor(hex);
  }

  function rememberColor(hex) {
    const recent = state.palette.recent.filter(function (c) { return c !== hex; });
    recent.unshift(hex);
    state.palette.recent = recent.slice(0, 18);
    Store.savePalette(state.palette);
    renderRecent();
  }

  function syncSwatchActive() {
    const all = document.querySelectorAll('.swatch[data-color]');
    all.forEach(function (el) {
      el.classList.toggle('active', U.normalizeHex(el.dataset.color) === state.color);
    });
  }

  function setWidth(value) {
    state.width = U.clamp(Math.round(Number(value) || 1), 1, 40);
    settings.width = state.width;
    Store.saveSettings(settings);
    dom.widthRange.value = state.width;
    dom.widthValue.textContent = state.width + ' px';
    if (dom.fillToggle) dom.fillToggle.classList.toggle('active', state.fill);
  }

  function setTextSize(value) {
    state.textSize = U.clamp(Math.round(Number(value) || 12), 12, 120);
    settings.textSize = state.textSize;
    Store.saveSettings(settings);
    dom.textSizeRange.value = state.textSize;
    dom.textSizeValue.textContent = state.textSize + ' px';
  }

  function setFill(value) {
    state.fill = !!value;
    settings.fill = state.fill;
    Store.saveSettings(settings);
    dom.fillToggle.classList.toggle('active', state.fill);
    dom.fillToggle.setAttribute('aria-pressed', state.fill ? 'true' : 'false');
    updateToolOptions();
  }

  function renderRecent() {
    if (!state.palette.recent.length) {
      dom.recentColors.innerHTML = '<p class="empty">用过的颜色会出现在这里</p>';
      return;
    }
    dom.recentColors.innerHTML = state.palette.recent.map(function (color) {
      return '<button class="swatch' + (color === state.color ? ' active' : '') +
        '" data-color="' + color + '" style="--c:' + color + '" title="' + color + '"></button>';
    }).join('');
  }

  function renderPalette() {
    dom.builtinFolders.innerHTML = Store.BUILTIN_FOLDERS.map(function (folder) {
      return folderHtml(folder, true);
    }).join('');
    dom.userFolders.innerHTML = state.palette.folders.length
      ? state.palette.folders.map(function (folder) { return folderHtml(folder, false); }).join('')
      : '<p class="empty" style="font-size:10.5px;color:var(--text-3);line-height:1.6;margin:4px 2px">还没有自定义颜色夹，点“新建”创建一个吧。</p>';
    syncSwatchActive();
  }

  function folderHtml(folder, builtin) {
    const collapsed = state.collapsed.has(folder.id);
    const colors = folder.colors.map(function (color) {
      return '<div class="swatch-wrap">' +
        '<button class="swatch' + (color === state.color ? ' active' : '') + '" data-color="' + color +
        '" style="--c:' + color + '" title="' + color + '"></button>' +
        (builtin ? '' : '<button class="swatch-del" data-color="' + color + '" data-folder="' + folder.id + '" title="从文件夹移除">×</button>') +
        '</div>';
    }).join('');
    return '<div class="folder' + (collapsed ? ' collapsed' : '') + '" data-folder="' + folder.id + '">' +
      '<div class="folder-head">' +
      '<button class="folder-toggle" data-toggle="' + folder.id + '">' +
      '<svg class="icon chev"><use href="#i-chevron"></use></svg>' +
      '<span class="folder-name">' + escapeHtml(folder.name) + '</span>' +
      '<span class="folder-count">' + folder.colors.length + '</span>' +
      '</button>' +
      (builtin ? '' :
        '<button class="folder-act add" data-add="' + folder.id + '" title="把当前颜色加入">' + icon('plus') + '</button>' +
        '<button class="folder-act del" data-del-folder="' + folder.id + '" title="删除颜色夹">' + icon('close') + '</button>') +
      '</div>' +
      '<div class="folder-body">' + (colors || '<p class="empty">还没有颜色，点 + 加入当前颜色</p>') + '</div>' +
      '</div>';
  }

  function handlePaletteClick(event) {
    const delColor = event.target.closest('.swatch-del');
    if (delColor) {
      const folder = state.palette.folders.find(function (f) { return f.id === delColor.dataset.folder; });
      if (folder) {
        folder.colors = folder.colors.filter(function (c) { return c !== delColor.dataset.color; });
        Store.savePalette(state.palette);
        renderPalette();
      }
      return;
    }
    const swatch = event.target.closest('.swatch');
    if (swatch && swatch.dataset.color) {
      setColor(swatch.dataset.color, true);
      return;
    }
    const addBtn = event.target.closest('[data-add]');
    if (addBtn) {
      addColorToFolder(addBtn.dataset.add);
      return;
    }
    const delFolder = event.target.closest('[data-del-folder]');
    if (delFolder) {
      deleteFolder(delFolder.dataset.delFolder);
      return;
    }
    const toggle = event.target.closest('.folder-toggle');
    if (toggle) {
      const folder = toggle.closest('.folder');
      const id = folder.dataset.folder;
      folder.classList.toggle('collapsed');
      if (folder.classList.contains('collapsed')) state.collapsed.add(id);
      else state.collapsed.delete(id);
    }
  }

  function addColorToFolder(id) {
    const folder = state.palette.folders.find(function (f) { return f.id === id; });
    if (!folder) return;
    if (folder.colors.some(function (c) { return c === state.color; })) {
      toast('这个颜色已经在「' + folder.name + '」里了');
      return;
    }
    folder.colors.push(state.color);
    state.collapsed.delete(id);
    Store.savePalette(state.palette);
    renderPalette();
    toast('已加入「' + folder.name + '」');
  }

  async function deleteFolder(id) {
    const folder = state.palette.folders.find(function (f) { return f.id === id; });
    if (!folder) return;
    const ok = await confirmDialog('删除颜色夹？', '「' + folder.name + '」及其中保存的颜色会被移除，画板内容不受影响。', '删除', true);
    if (!ok) return;
    state.palette.folders = state.palette.folders.filter(function (f) { return f.id !== id; });
    Store.savePalette(state.palette);
    renderPalette();
    toast('颜色夹已删除');
  }

  async function createFolder() {
    const name = await promptDialog('新建颜色夹', '把常用颜色收进自己的文件夹，下次打开可以直接使用。', '我的色卡', '例如：海报配色');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast('请先输入文件夹名称', 'error');
      return;
    }
    state.palette.folders.push({
      id: U.uid('folder'),
      name: trimmed.slice(0, 20),
      colors: [state.color]
    });
    Store.savePalette(state.palette);
    renderPalette();
    toast('颜色夹已创建，当前颜色已放入');
  }

  /* ==========================================================================
     画板背景 / 尺寸 / 缩放
     ========================================================================== */

  function syncBoardUI() {
    const board = state.board;
    dom.boardColorInput.value = board.bg;
    const inline = dom.boardColorInput.closest('.inline-color');
    if (inline) inline.style.setProperty('--board-preview', board.bg);
    dom.boardW.value = board.w;
    dom.boardH.value = board.h;
    dom.boardSizeBadge.textContent = board.w + ' × ' + board.h;
    dom.boardMeta.textContent = board.w + ' × ' + board.h;
    document.querySelectorAll('#patternGroup button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.pattern === board.pattern);
    });
    document.querySelectorAll('#boardPresets .swatch').forEach(function (btn) {
      btn.classList.toggle('active', U.normalizeHex(btn.dataset.boardBg) === board.bg);
    });
  }

  function renderBoardPresets() {
    dom.boardPresets.innerHTML = BOARD_PRESETS.map(function (color) {
      return '<button class="swatch' + (color === state.board.bg ? ' active' : '') +
        '" data-board-bg="' + color + '" style="--c:' + color + '" title="' + color + '"></button>';
    }).join('');
  }

  function setBoardBg(value) {
    const hex = U.normalizeHex(value);
    if (!hex) return;
    state.board.bg = hex;
    syncBoardUI();
    requestRender();
    scheduleAutosave();
  }

  function applyBoardSize(width, height, quiet) {
    const w = Math.round(U.clamp(Number(width) || state.board.w, 320, 4000));
    const h = Math.round(U.clamp(Number(height) || state.board.h, 240, 4000));
    if (w === state.board.w && h === state.board.h) {
      if (!quiet) toast('画板尺寸没有变化');
      return;
    }
    state.board.w = w;
    state.board.h = h;
    setupCanvas();
    fitBoard();
    syncBoardUI();
    scheduleAutosave();
    if (!quiet) toast('画板已调整为 ' + w + ' × ' + h);
  }

  function setupCanvas() {
    const board = state.board;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let scale = Math.max(1, dpr);
    const maxPixels = 16 * 1000 * 1000;
    if (board.w * board.h * scale * scale > maxPixels) {
      scale = Math.sqrt(maxPixels / (board.w * board.h));
    }
    state.resScale = Math.max(1, Math.min(scale, 2.5));
    dom.canvas.width = Math.round(board.w * state.resScale);
    dom.canvas.height = Math.round(board.h * state.resScale);
    applyZoomSize();
    syncBoardUI();
  }

  function applyZoomSize() {
    const w = Math.max(1, Math.round(state.board.w * state.zoom));
    const h = Math.max(1, Math.round(state.board.h * state.zoom));
    dom.canvas.style.width = w + 'px';
    dom.canvas.style.height = h + 'px';
    dom.stage.style.width = w + 'px';
    dom.stage.style.height = h + 'px';
    const extraTop = Math.max(0, Math.round((dom.viewport.clientHeight - 68 - h) / 2));
    dom.stage.style.marginTop = extraTop + 'px';
    dom.zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
  }

  function fitBoard() {
    const vw = dom.viewport.clientWidth - 68;
    const vh = dom.viewport.clientHeight - 68;
    if (vw <= 0 || vh <= 0) return;
    state.zoom = U.clamp(Math.min(vw / state.board.w, vh / state.board.h), 0.15, 2);
    state.zoomMode = 'fit';
    applyZoomSize();
    requestRender();
    requestAnimationFrame(function () {
      dom.viewport.scrollLeft = Math.max(0, (dom.viewport.scrollWidth - dom.viewport.clientWidth) / 2);
      dom.viewport.scrollTop = Math.max(0, (dom.viewport.scrollHeight - dom.viewport.clientHeight) / 2);
    });
  }

  function setZoom(value, anchorEvent) {
    if (state.textEditor) finishTextEditor(true);
    const next = U.clamp(value, 0.15, 3);
    if (Math.abs(next - state.zoom) < 0.0005) return;
    const old = state.zoom;
    const canvasRect = dom.canvas.getBoundingClientRect();
    let ax;
    let ay;
    if (anchorEvent) {
      ax = anchorEvent.clientX;
      ay = anchorEvent.clientY;
    } else {
      const vr = dom.viewport.getBoundingClientRect();
      ax = vr.left + vr.width / 2;
      ay = vr.top + vr.height / 2;
    }
    const bx = (ax - canvasRect.left) / old;
    const by = (ay - canvasRect.top) / old;
    state.zoom = next;
    state.zoomMode = 'custom';
    applyZoomSize();
    const nr = dom.canvas.getBoundingClientRect();
    dom.viewport.scrollLeft += (nr.left + bx * next) - ax;
    dom.viewport.scrollTop += (nr.top + by * next) - ay;
    requestRender();
  }

  /* ==========================================================================
     渲染
     ========================================================================== */

  function paintBackground(targetCtx, board) {
    const key = board.bg + '|' + board.pattern + '|' + board.w + 'x' + board.h;
    if (!bgCache || bgCacheKey !== key) {
      buildBackgroundCache(board);
      bgCacheKey = key;
    }
    targetCtx.drawImage(bgCache, 0, 0, board.w, board.h);
  }

  function buildBackgroundCache(board) {
    const cacheWidth = Math.min(2200, board.w);
    const ratio = cacheWidth / board.w;
    const cacheHeight = Math.max(1, Math.round(board.h * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = cacheWidth;
    canvas.height = cacheHeight;
    const c = canvas.getContext('2d');
    c.scale(ratio, ratio);
    c.fillStyle = board.bg;
    c.fillRect(0, 0, board.w, board.h);

    const light = U.luminance(board.bg) > 0.5;
    const ink = light ? '15,23,42' : '255,255,255';
    c.save();
    c.beginPath();
    c.rect(0, 0, board.w, board.h);
    c.clip();

    if (board.pattern === 'dots') {
      const step = 26;
      c.fillStyle = 'rgba(' + ink + ',' + (light ? '0.16' : '0.12') + ')';
      for (let x = step; x < board.w; x += step) {
        for (let y = step; y < board.h; y += step) {
          c.beginPath();
          c.arc(x, y, 1.05, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else if (board.pattern === 'grid') {
      const step = 40;
      c.strokeStyle = 'rgba(' + ink + ',' + (light ? '0.07' : '0.06') + ')';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = step; x < board.w; x += step) {
        c.moveTo(x, 0);
        c.lineTo(x, board.h);
      }
      for (let y = step; y < board.h; y += step) {
        c.moveTo(0, y);
        c.lineTo(board.w, y);
      }
      c.stroke();
    } else if (board.pattern === 'lines') {
      const step = 38;
      c.strokeStyle = 'rgba(' + ink + ',' + (light ? '0.1' : '0.08') + ')';
      c.lineWidth = 1;
      c.beginPath();
      for (let y = step; y < board.h; y += step) {
        c.moveTo(26, y);
        c.lineTo(board.w - 26, y);
      }
      c.stroke();
    }
    c.restore();
    bgCache = canvas;
  }

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      render();
    });
  }

  function render() {
    const board = state.board;
    ctx.setTransform(state.resScale, 0, 0, state.resScale, 0, 0);
    paintBackground(ctx, board);
    state.objects.forEach(function (obj) {
      if (obj.id === state.editingId) return;
      S.drawObject(ctx, obj);
    });
    if (state.gesture && state.gesture.preview) {
      S.drawObject(ctx, state.gesture.preview);
    }
    drawSelectionOverlay();
    drawEraserCursor();
  }

  function getSelectionBounds() {
    let bounds = null;
    state.selection.forEach(function (id) {
      const obj = state.objects.find(function (o) { return o.id === id; });
      if (!obj) return;
      const b = S.bounds(obj);
      if (!bounds) {
        bounds = { x: b.x, y: b.y, w: b.w, h: b.h };
      } else {
        const minX = Math.min(bounds.x, b.x);
        const minY = Math.min(bounds.y, b.y);
        const maxX = Math.max(bounds.x + bounds.w, b.x + b.w);
        const maxY = Math.max(bounds.y + bounds.h, b.y + b.h);
        bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    });
    return bounds;
  }

  function handlePoints(bounds) {
    const b = bounds;
    return [
      { key: 'nw', x: b.x, y: b.y },
      { key: 'ne', x: b.x + b.w, y: b.y },
      { key: 'sw', x: b.x, y: b.y + b.h },
      { key: 'se', x: b.x + b.w, y: b.y + b.h }
    ];
  }

  function hitHandle(point, bounds) {
    if (!bounds) return null;
    const threshold = 9 / state.zoom;
    const points = handlePoints(bounds);
    for (let i = 0; i < points.length; i++) {
      if (Math.abs(point.x - points[i].x) <= threshold && Math.abs(point.y - points[i].y) <= threshold) {
        return points[i].key;
      }
    }
    return null;
  }

  function drawSelectionOverlay() {
    const bounds = getSelectionBounds();
    if (!bounds) return;
    const z = state.zoom;
    const accent = settings.themeColor;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2 / z;
    ctx.setLineDash([5 / z, 4 / z]);
    ctx.strokeRect(bounds.x - 2 / z, bounds.y - 2 / z, bounds.w + 4 / z, bounds.h + 4 / z);
    ctx.setLineDash([]);
    if (state.selection.size === 1) {
      const size = 8 / z;
      const points = handlePoints(bounds);
      points.forEach(function (p) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4 / z;
        ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
      });
    }
    ctx.restore();

    if (state.gesture && state.gesture.kind === 'marquee') {
      const rect = gestureRect(state.gesture.start, state.gesture.current);
      ctx.save();
      ctx.fillStyle = U.alpha(accent, 0.08);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2 / z;
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  function eraserRadius() {
    return U.clamp(8 + state.width * 2.2, 10, 70);
  }

  function drawEraserCursor() {
    if (state.tool !== 'eraser' || !state.eraserPos) return;
    const z = state.zoom;
    const radius = eraserRadius();
    ctx.save();
    ctx.beginPath();
    ctx.arc(state.eraserPos.x, state.eraserPos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.strokeStyle = settings.themeColor;
    ctx.lineWidth = 1.4 / z;
    ctx.setLineDash([4 / z, 3 / z]);
    ctx.stroke();
    ctx.restore();
  }

  /* ==========================================================================
     坐标系 / 光标
     ========================================================================== */

  function toBoard(event) {
    const rect = dom.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / state.zoom,
      y: (event.clientY - rect.top) / state.zoom
    };
  }

  function setStageCursor(key) {
    dom.stage.classList.remove('cursor-crosshair', 'cursor-move', 'cursor-nwse', 'cursor-nesw', 'cursor-text', 'cursor-none');
    if (key) dom.stage.classList.add('cursor-' + key);
  }

  function updateToolCursor() {
    if (state.tool === 'pen' || S.isShapeType(state.tool)) setStageCursor('crosshair');
    else if (state.tool === 'text') setStageCursor('text');
    else if (state.tool === 'eraser') setStageCursor('none');
    else setStageCursor('');
  }

  function updateHoverCursor(point) {
    if (state.tool !== 'select' || state.gesture) return;
    const bounds = getSelectionBounds();
    if (bounds && state.selection.size === 1) {
      const handle = hitHandle(point, bounds);
      if (handle) {
        setStageCursor(handle === 'nw' || handle === 'se' ? 'nwse' : 'nesw');
        return;
      }
    }
    const obj = objectAt(point.x, point.y);
    setStageCursor(obj ? 'move' : '');
  }

  function objectAt(x, y) {
    const tol = 6 / state.zoom;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      if (S.hitTest(state.objects[i], x, y, tol)) return state.objects[i];
    }
    return null;
  }

  function gestureRect(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y)
    };
  }

  /* ==========================================================================
     工具切换
     ========================================================================== */

  function setTool(tool) {
    if (!tool) return;
    if (state.textEditor) finishTextEditor(true);
    state.tool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    const isShape2d = S.SHAPES_2D.some(function (s) { return s.type === tool; });
    const isShape3d = S.SHAPES_3D.some(function (s) { return s.type === tool; });
    dom.shapeBtn.classList.toggle('active', isShape2d);
    dom.shape3dBtn.classList.toggle('active', isShape3d);
    updateToolOptions();
    updateToolCursor();
    dom.toolBadge.textContent = TOOL_NAMES[tool] || S.labelFor(tool);
    requestRender();
  }

  function updateToolOptions() {
    let hint = '';
    let showFill = false;
    if (state.tool === 'select') {
      hint = '选择 · 拖动移动，角点缩放';
    } else if (state.tool === 'pen') {
      hint = '钢笔 · 左键 / 右键拖动绘制';
    } else if (state.tool === 'eraser') {
      hint = '橡皮 · 滑过内容即可擦除';
    } else if (state.tool === 'text') {
      hint = '文字 · 点击画板输入，Ctrl + Enter 完成';
    } else if (S.isShapeType(state.tool)) {
      hint = S.labelFor(state.tool) + ' · 拖动绘制 · Shift 等比';
      showFill = S.SHAPES_2D.some(function (s) { return s.type === state.tool; });
    }
    dom.toolHint.textContent = hint;
    dom.fillToggle.hidden = !showFill;
    dom.fillToggle.classList.toggle('active', state.fill);
    dom.fillToggle.setAttribute('aria-pressed', state.fill ? 'true' : 'false');
  }

  /* ==========================================================================
     撤销 / 重做 / 变更
     ========================================================================== */

  function snapshotObjects() {
    return JSON.stringify(state.objects);
  }

  function beginChange() {
    if (history.pending !== null) return;
    history.pending = snapshotObjects();
  }

  function endChange() {
    if (history.pending === null) return false;
    const before = history.pending;
    history.pending = null;
    if (snapshotObjects() === before) return false;
    history.past.push(before);
    if (history.past.length > 80) history.past.shift();
    history.future.length = 0;
    updateHistoryButtons();
    afterContentChange();
    return true;
  }

  function commitChange(fn) {
    if (history.pending !== null) {
      fn();
      return;
    }
    beginChange();
    fn();
    endChange();
  }

  function afterContentChange() {
    updateEmptyState();
    updateSelectionBar();
    requestRender();
    scheduleAutosave();
  }

  function updateHistoryButtons() {
    dom.undoBtn.disabled = history.past.length === 0;
    dom.redoBtn.disabled = history.future.length === 0;
  }

  function undo() {
    if (!history.past.length) return;
    if (state.textEditor) cancelTextEditor();
    history.future.push(snapshotObjects());
    state.objects = JSON.parse(history.past.pop());
    state.selection.clear();
    updateHistoryButtons();
    afterContentChange();
  }

  function redo() {
    if (!history.future.length) return;
    if (state.textEditor) cancelTextEditor();
    history.past.push(snapshotObjects());
    state.objects = JSON.parse(history.future.pop());
    state.selection.clear();
    updateHistoryButtons();
    afterContentChange();
  }

  /* ==========================================================================
     选择操作
     ========================================================================== */

  function updateSelectionBar() {
    const count = state.selection.size;
    dom.selectionBar.hidden = count === 0;
    if (count) dom.selCount.textContent = '已选 ' + count + ' 项';
  }

  function deleteSelection() {
    if (!state.selection.size) return;
    const ids = new Set(state.selection);
    commitChange(function () {
      state.objects = state.objects.filter(function (o) { return !ids.has(o.id); });
      state.selection.clear();
    });
  }

  function duplicateSelection() {
    if (!state.selection.size) return;
    const clones = [];
    state.objects.forEach(function (obj) {
      if (!state.selection.has(obj.id)) return;
      const copy = U.clone(obj);
      copy.id = U.uid(obj.type === 'stroke' ? 's' : obj.type === 'text' ? 't' : 'sh');
      S.translate(copy, 18, 18);
      clones.push(copy);
    });
    commitChange(function () {
      clones.forEach(function (copy) { state.objects.push(copy); });
      state.selection = new Set(clones.map(function (c) { return c.id; }));
    });
    toast('已复制 ' + clones.length + ' 个对象');
  }

  function bringSelectionToFront() {
    if (!state.selection.size) return;
    commitChange(function () {
      const selected = state.objects.filter(function (o) { return state.selection.has(o.id); });
      const rest = state.objects.filter(function (o) { return !state.selection.has(o.id); });
      state.objects = rest.concat(selected);
    });
  }

  function sendSelectionToBack() {
    if (!state.selection.size) return;
    commitChange(function () {
      const selected = state.objects.filter(function (o) { return state.selection.has(o.id); });
      const rest = state.objects.filter(function (o) { return !state.selection.has(o.id); });
      state.objects = selected.concat(rest);
    });
  }

  function nudgeSelection(dx, dy) {
    if (!state.selection.size) return;
    commitChange(function () {
      state.objects.forEach(function (obj) {
        if (state.selection.has(obj.id)) S.translate(obj, dx, dy);
      });
    });
  }

  function selectAll() {
    state.selection = new Set(state.objects.map(function (o) { return o.id; }));
    updateSelectionBar();
    requestRender();
  }

  /* ==========================================================================
     文本输入
     ========================================================================== */

  function openTextEditor(point, existing) {
    if (state.textEditor) finishTextEditor(true);
    const ed = {
      existing: existing || null,
      x: existing ? existing.x : point.x,
      y: existing ? existing.y : point.y,
      size: existing ? existing.size : state.textSize,
      color: existing ? existing.color : state.color,
      el: null
    };
    const ta = document.createElement('textarea');
    ta.className = 'board-text-editor';
    ta.value = existing ? existing.text : '';
    ta.spellcheck = false;
    ta.wrap = 'off';
    ta.rows = 1;
    ta.style.left = (ed.x * state.zoom) + 'px';
    ta.style.top = (ed.y * state.zoom) + 'px';
    ta.style.fontSize = (ed.size * state.zoom) + 'px';
    ta.style.lineHeight = '1.3';
    ta.style.color = ed.color;
    dom.stage.appendChild(ta);
    ed.el = ta;
    state.textEditor = ed;
    if (existing) {
      state.editingId = existing.id;
      state.selection.clear();
      updateSelectionBar();
    }

    const autoGrow = function () {
      const mctx = getMeasureCtx();
      mctx.font = S.font(ed.size);
      const lines = ta.value.split('\n');
      let maxWidth = 0;
      lines.forEach(function (line) {
        maxWidth = Math.max(maxWidth, mctx.measureText(line || ' ').width);
      });
      ta.style.width = Math.max(120, maxWidth * state.zoom + 22) + 'px';
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight || ed.size * state.zoom * 1.3 + 10) + 'px';
    };
    ta.addEventListener('input', autoGrow);
    ta.addEventListener('blur', function () { finishTextEditor(true); });
    ta.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelTextEditor();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        finishTextEditor(true);
      }
    });
    ta.focus();
    autoGrow();
    updateEmptyState();
    requestRender();
  }

  function finishTextEditor(commit) {
    if (!state.textEditor) return;
    const ed = state.textEditor;
    state.textEditor = null;
    const value = ed.el.value.replace(/\s+$/, '');
    ed.el.remove();
    if (ed.existing) {
      const id = ed.existing.id;
      const text = value.trim();
      if (!text) {
        commitChange(function () {
          state.objects = state.objects.filter(function (o) { return o.id !== id; });
          state.selection.clear();
        });
      } else if (text !== ed.existing.text) {
        commitChange(function () {
          const obj = state.objects.find(function (o) { return o.id === id; });
          if (obj) {
            obj.text = text;
            obj.x = ed.x;
            obj.y = ed.y;
            obj.size = ed.size;
            obj.color = ed.color;
          }
        });
      }
      state.editingId = null;
    } else if (commit) {
      const text = value.trim();
      if (text) {
        commitChange(function () {
          state.objects.push({
            id: U.uid('t'),
            type: 'text',
            x: ed.x,
            y: ed.y,
            text: text,
            color: ed.color,
            size: ed.size,
            width: 1
          });
        });
      }
    }
    state.editingId = null;
    afterContentChange();
  }

  function cancelTextEditor() {
    if (!state.textEditor) return;
    const ed = state.textEditor;
    state.textEditor = null;
    ed.el.remove();
    state.editingId = null;
    updateEmptyState();
    requestRender();
  }

  /* ==========================================================================
     绘画 / 橡皮 / 图形
     ========================================================================== */

  function startDraw(point) {
    beginChange();
    state.selection.clear();
    updateSelectionBar();
    const obj = {
      id: U.uid('s'),
      type: 'stroke',
      points: [{ x: point.x, y: point.y }],
      color: state.color,
      width: state.width
    };
    state.objects.push(obj);
    state.gesture = { kind: 'draw', obj: obj, pointerId: null };
    updateEmptyState();
    requestRender();
  }

  function appendDrawPoint(point) {
    const gesture = state.gesture;
    if (!gesture || gesture.kind !== 'draw') return;
    const pts = gesture.obj.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.9) return;
    pts.push({ x: point.x, y: point.y });
  }

  function eraseAt(cx, cy) {
    const radius = eraserRadius();
    const next = [];
    let changed = false;
    state.objects.forEach(function (obj) {
      if (obj.type === 'stroke') {
        const pts = obj.points || [];
        const runs = [];
        let run = [];
        let removed = false;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (Math.hypot(p.x - cx, p.y - cy) <= radius) {
            removed = true;
            if (run.length > 1) runs.push(run);
            run = [];
          } else {
            run.push(p);
          }
        }
        if (!removed) {
          next.push(obj);
          return;
        }
        changed = true;
        if (run.length > 1) runs.push(run);
        runs.forEach(function (segment) {
          next.push({
            id: U.uid('s'),
            type: 'stroke',
            points: segment,
            color: obj.color,
            width: obj.width
          });
        });
        return;
      }
      const b = S.bounds(obj);
      if (obj.type === 'line' || obj.type === 'arrow') {
        if (S.hitTest(obj, cx, cy, radius)) {
          changed = true;
          return;
        }
        next.push(obj);
        return;
      }
      const nx = U.clamp(cx, b.x, b.x + b.w);
      const ny = U.clamp(cy, b.y, b.y + b.h);
      if (Math.hypot(cx - nx, cy - ny) <= radius) {
        changed = true;
        return;
      }
      next.push(obj);
    });
    if (changed) {
      state.objects = next;
      state.selection.clear();
      updateEmptyState();
    }
  }

  function startShape(point) {
    beginChange();
    const preview = {
      id: 'preview',
      type: state.tool,
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      color: state.color,
      width: state.width,
      fill: state.fill
    };
    state.gesture = { kind: 'shape', start: point, preview: preview, pointerId: null };
    updateEmptyState();
    requestRender();
  }

  function constrainShape(type, start, end, shiftKey) {
    if (!shiftKey) return end;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (type === 'line' || type === 'arrow') {
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      return { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len };
    }
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + (dx < 0 ? -size : size),
      y: start.y + (dy < 0 ? -size : size)
    };
  }

  function updateShape(point, shiftKey) {
    if (!state.gesture || state.gesture.kind !== 'shape') return;
    const end = constrainShape(state.gesture.preview.type, state.gesture.start, point, shiftKey);
    state.gesture.preview.x2 = end.x;
    state.gesture.preview.y2 = end.y;
  }

  function finalizeShape(pointerCanceled) {
    const gesture = state.gesture;
    if (!gesture || gesture.kind !== 'shape') return;
    if (pointerCanceled) {
      state.gesture = null;
      endChange();
      return;
    }
    const preview = gesture.preview;
    const isLine = preview.type === 'line' || preview.type === 'arrow';
    const width = Math.abs(preview.x2 - preview.x1);
    const height = Math.abs(preview.y2 - preview.y1);
    const tooSmall = isLine ? Math.hypot(width, height) < 8 : width < 5 || height < 5;
    if (tooSmall) {
      if (isLine) {
        preview.x1 = gesture.start.x - 90;
        preview.y1 = gesture.start.y;
        preview.x2 = gesture.start.x + 90;
        preview.y2 = gesture.start.y;
      } else {
        const w = S.is3D(preview.type) ? 150 : 160;
        const h = S.is3D(preview.type) ? 130 : 110;
        preview.x1 = gesture.start.x - w / 2;
        preview.y1 = gesture.start.y - h / 2;
        preview.x2 = gesture.start.x + w / 2;
        preview.y2 = gesture.start.y + h / 2;
      }
    }
    preview.id = U.uid('sh');
    state.objects.push(preview);
    state.gesture = null;
    endChange();
  }

  /* ==========================================================================
     指针事件
     ========================================================================== */

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    if (state.gesture) return;
    if (state.textEditor) finishTextEditor(true);
    state.pendingTextEdit = null;
    const point = toBoard(event);
    const rightPen = event.button === 2;

    if (!rightPen && state.tool === 'text') {
      event.preventDefault();
      cancelTextEditor();
      openTextEditor(point, null);
      return;
    }

    event.preventDefault();
    try { dom.canvas.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }

    if (rightPen || state.tool === 'pen') {
      startDraw(point);
      state.gesture.pointerId = event.pointerId;
      state.eraserPos = null;
      setStageCursor('crosshair');
      return;
    }

    if (state.tool === 'eraser') {
      beginChange();
      state.gesture = { kind: 'erase', last: point, pointerId: event.pointerId };
      state.eraserPos = point;
      eraseAt(point.x, point.y);
      requestRender();
      return;
    }

    if (S.isShapeType(state.tool)) {
      startShape(point);
      state.gesture.pointerId = event.pointerId;
      return;
    }

    if (state.tool === 'select') {
      handleSelectDown(point, event);
    }
  }

  function handleSelectDown(point, event) {
    const bounds = getSelectionBounds();
    if (bounds && state.selection.size === 1) {
      const handle = hitHandle(point, bounds);
      if (handle) {
        startResize(point, event, handle, bounds);
        return;
      }
    }

    const obj = objectAt(point.x, point.y);
    if (obj) {
      const now = performance.now();
      if (!event.shiftKey && obj.type === 'text' && state.lastTextClick &&
          state.lastTextClick.id === obj.id && now - state.lastTextClick.time < 380) {
        state.lastTextClick = null;
        state.pendingTextEdit = obj.id;
      } else {
        state.lastTextClick = obj.type === 'text' ? { id: obj.id, time: now } : null;
        state.pendingTextEdit = null;
      }
      if (event.shiftKey) {
        if (state.selection.has(obj.id)) {
          state.selection.delete(obj.id);
          updateSelectionBar();
          requestRender();
          return;
        }
        state.selection.add(obj.id);
      } else if (!state.selection.has(obj.id)) {
        state.selection = new Set([obj.id]);
      }
      updateSelectionBar();
      requestRender();
      startMove(point, event);
      return;
    }

    const additive = event.shiftKey;
    state.lastTextClick = null;
    if (!additive) {
      state.selection.clear();
      updateSelectionBar();
    }
    startMarquee(point, event, additive, new Set(state.selection));
  }

  function startMove(point, event) {
    beginChange();
    const items = [];
    state.selection.forEach(function (id) {
      const index = state.objects.findIndex(function (o) { return o.id === id; });
      if (index >= 0) items.push({ index: index, origin: U.clone(state.objects[index]) });
    });
    state.gesture = { kind: 'move', start: point, items: items, pointerId: event.pointerId, moved: false };
  }

  function startResize(point, event, handle, bounds) {
    const id = Array.from(state.selection)[0];
    const index = state.objects.findIndex(function (o) { return o.id === id; });
    if (index < 0) return;
    beginChange();
    state.gesture = {
      kind: 'resize',
      start: point,
      handle: handle,
      bounds: bounds,
      index: index,
      origin: U.clone(state.objects[index]),
      pointerId: event.pointerId
    };
  }

  function startMarquee(point, event, additive, base) {
    state.gesture = {
      kind: 'marquee',
      start: point,
      current: point,
      additive: additive,
      base: base,
      pointerId: event.pointerId
    };
    requestRender();
  }

  function onPointerMove(event) {
    const point = toBoard(event);
    if (state.tool === 'eraser' || (state.gesture && state.gesture.kind === 'erase')) {
      state.eraserPos = point;
    }

    if (!state.gesture) {
      if (state.tool !== 'eraser') updateHoverCursor(point);
      if (state.tool === 'eraser') requestRender();
      return;
    }
    const gesture = state.gesture;
    if (gesture.pointerId !== event.pointerId) return;

    if (gesture.kind === 'draw') {
      appendDrawPoint(point);
      requestRender();
      return;
    }

    if (gesture.kind === 'erase') {
      const last = gesture.last;
      const distance = Math.hypot(point.x - last.x, point.y - last.y);
      const radius = eraserRadius();
      const steps = Math.max(1, Math.ceil(distance / Math.max(4, radius * 0.45)));
      for (let i = 1; i <= steps; i++) {
        eraseAt(last.x + (point.x - last.x) * (i / steps), last.y + (point.y - last.y) * (i / steps));
      }
      gesture.last = point;
      requestRender();
      return;
    }

    if (gesture.kind === 'shape') {
      updateShape(point, event.shiftKey);
      requestRender();
      return;
    }

    if (gesture.kind === 'move') {
      let dx = point.x - gesture.start.x;
      let dy = point.y - gesture.start.y;
      if (Math.hypot(dx, dy) > 2 / state.zoom) gesture.moved = true;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      gesture.items.forEach(function (item) {
        const copy = U.clone(item.origin);
        S.translate(copy, dx, dy);
        state.objects[item.index] = copy;
      });
      requestRender();
      return;
    }

    if (gesture.kind === 'resize') {
      const b = gesture.bounds;
      let w;
      let h;
      if (gesture.handle.indexOf('w') >= 0) w = b.x + b.w - point.x;
      else w = point.x - b.x;
      if (gesture.handle.indexOf('n') >= 0) h = b.y + b.h - point.y;
      else h = point.y - b.y;
      const sx = U.clamp(w / Math.max(1, b.w), 0.06, 20);
      const sy = U.clamp(h / Math.max(1, b.h), 0.06, 20);
      const ox = gesture.handle.indexOf('w') >= 0 ? b.x + b.w : b.x;
      const oy = gesture.handle.indexOf('n') >= 0 ? b.y + b.h : b.y;
      const copy = U.clone(gesture.origin);
      S.scale(copy, sx, sy, ox, oy);
      state.objects[gesture.index] = copy;
      requestRender();
      return;
    }

    if (gesture.kind === 'marquee') {
      gesture.current = point;
      const rect = gestureRect(gesture.start, point);
      const selection = new Set(gesture.additive ? gesture.base : []);
      state.objects.forEach(function (obj) {
        if (U.rectsIntersect(S.bounds(obj), rect)) selection.add(obj.id);
      });
      state.selection = selection;
      updateSelectionBar();
      requestRender();
    }
  }

  function releasePointer(event) {
    try {
      if (dom.canvas.hasPointerCapture(event.pointerId)) dom.canvas.releasePointerCapture(event.pointerId);
    } catch (err) { /* ignore */ }
  }

  function finishGesture(event, canceled) {
    const gesture = state.gesture;
    if (!gesture) return;
    if (gesture.pointerId !== null && event && gesture.pointerId !== event.pointerId) return;
    const editTextId = !canceled && gesture.kind === 'move' && state.pendingTextEdit && !gesture.moved
      ? state.pendingTextEdit
      : null;
    state.pendingTextEdit = null;
    if (gesture.kind === 'shape') {
      if (event && !canceled) updateShape(toBoard(event), event.shiftKey);
      finalizeShape(canceled);
    } else if (gesture.kind === 'marquee') {
      const rect = gestureRect(gesture.start, gesture.current || gesture.start);
      const selection = new Set(gesture.additive ? gesture.base : []);
      if (rect.w > 2 || rect.h > 2) {
        state.objects.forEach(function (obj) {
          if (U.rectsIntersect(S.bounds(obj), rect)) selection.add(obj.id);
        });
      }
      state.selection = selection;
      state.gesture = null;
      updateSelectionBar();
      requestRender();
    } else {
      state.gesture = null;
      endChange();
    }
    if (event) releasePointer(event);
    if (state.tool === 'eraser' && event) {
      state.eraserPos = toBoard(event);
    } else if (state.tool !== 'eraser') {
      state.eraserPos = null;
    }
    if (editTextId) {
      const obj = state.objects.find(function (o) { return o.id === editTextId; });
      if (obj && obj.type === 'text') {
        openTextEditor({ x: obj.x, y: obj.y }, obj);
        return;
      }
    }
    updateHoverCursor(event ? toBoard(event) : { x: -999, y: -999 });
    requestRender();
  }

  function onPointerUp(event) {
    finishGesture(event, false);
  }

  function onPointerCancel(event) {
    finishGesture(event, true);
  }

  function onPointerLeave() {
    if (state.gesture) return;
    if (state.eraserPos) {
      state.eraserPos = null;
      requestRender();
    }
  }

  /* ==========================================================================
     自动保存 / 快照 / 导入导出
     ========================================================================== */

  function updateAutosaveCard() {
    dom.autosaveCard.classList.toggle('off', !settings.autosave);
    const strong = dom.autosaveCard.querySelector('strong');
    if (strong) strong.textContent = settings.autosave ? '自动保存已开启' : '自动保存已关闭';
    if (!settings.autosave) {
      dom.autosaveState.textContent = state.lastSaved
        ? '最近手动保存 ' + formatShortTime(state.lastSaved)
        : '自动保存已关闭，可手动保存';
    } else if (state.lastSaved) {
      dom.autosaveState.textContent = '最近保存 ' + formatShortTime(state.lastSaved);
    } else {
      dom.autosaveState.textContent = '等待第一次保存';
    }
  }

  function scheduleAutosave() {
    state.dirty = true;
    if (!settings.autosave) {
      setSaveState('自动保存已关闭', 'off');
      return;
    }
    setSaveState('正在缓存…', 'saving');
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(function () { saveNow(true); }, 650);
  }

  function saveNow(silent) {
    clearTimeout(state.autosaveTimer);
    const doc = {
      version: 1,
      title: state.title || '未命名白板',
      board: state.board,
      objects: state.objects,
      savedAt: Date.now()
    };
    const ok = Store.saveDoc(doc);
    if (ok) {
      state.lastSaved = new Date();
      state.dirty = false;
      setSaveState('已缓存 ' + formatShortTime(state.lastSaved));
      updateAutosaveCard();
      if (!silent) toast('已保存到本机浏览器');
    } else {
      setSaveState('保存失败：存储空间不足', 'error');
      if (!silent) toast('保存失败，可能是浏览器存储空间已满', 'error');
    }
    return ok;
  }

  function renderSaves() {
    if (!state.saves.length) {
      dom.savesList.innerHTML = '<p class="empty">还没有手动快照。当前内容会自动缓存，也可以在这里保存多个版本。</p>';
      return;
    }
    dom.savesList.innerHTML = state.saves.map(function (item) {
      return '<div class="save-item" data-save-id="' + item.id + '">' +
        '<div class="save-item-info">' +
        '<div class="save-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="save-item-meta">' + U.formatDateTime(item.time) + ' · ' + item.objects.length + ' 个对象</div>' +
        '</div>' +
        '<div class="save-item-actions">' +
        '<button class="icon-mini" data-load-save="' + item.id + '" title="载入这个快照">' + icon('upload') + '</button>' +
        '<button class="icon-mini danger" data-delete-save="' + item.id + '" title="删除快照">' + icon('trash') + '</button>' +
        '</div></div>';
    }).join('');
  }

  function saveSnapshot() {
    const fallback = state.title + ' · ' + U.formatDateTime(Date.now());
    const name = dom.snapName.value.trim() || fallback;
    state.saves.unshift({
      id: U.uid('save'),
      name: name.slice(0, 60),
      time: Date.now(),
      title: state.title,
      board: U.clone(state.board),
      objects: U.clone(state.objects)
    });
    state.saves = state.saves.slice(0, 40);
    const ok = Store.saveSaves(state.saves);
    dom.snapName.value = '';
    renderSaves();
    if (!ok) {
      toast('快照保存失败，可能是浏览器存储空间已满', 'error');
      return;
    }
    toast('快照已保存');
  }

  async function loadSnapshot(id) {
    const item = state.saves.find(function (s) { return s.id === id; });
    if (!item) return;
    const ok = await confirmDialog('载入这个快照？', '当前画板会被「' + item.name + '」替换。当前内容已经自动缓存，载入前也可以先保存一个快照。', '载入');
    if (!ok) return;
    cancelTextEditor();
    state.objects = U.clone(item.objects).filter(isValidObject);
    state.board = Store.normalizeBoard(item.board);
    state.title = item.title || '未命名白板';
    state.selection.clear();
    state.editingId = null;
    history.past = [];
    history.future = [];
    updateHistoryButtons();
    dom.docTitle.value = state.title;
    updateDocumentTitle();
    setupCanvas();
    fitBoard();
    renderBoardPresets();
    syncBoardUI();
    updateEmptyState();
    scheduleAutosave();
    saveNow(true);
    requestRender();
    toast('已载入快照「' + item.name + '」');
  }

  async function deleteSnapshot(id) {
    const item = state.saves.find(function (s) { return s.id === id; });
    if (!item) return;
    const ok = await confirmDialog('删除快照？', '「' + item.name + '」将从本机移除。', '删除', true);
    if (!ok) return;
    state.saves = state.saves.filter(function (s) { return s.id !== id; });
    Store.saveSaves(state.saves);
    renderSaves();
    toast('快照已删除');
  }

  function exportPng() {
    if (state.textEditor) finishTextEditor(true);
    const maxSide = Math.max(state.board.w, state.board.h);
    const scale = Math.min(2, Math.max(1, 4096 / maxSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(state.board.w * scale);
    canvas.height = Math.round(state.board.h * scale);
    const c = canvas.getContext('2d');
    c.scale(scale, scale);
    paintBackground(c, state.board);
    state.objects.forEach(function (obj) { S.drawObject(c, obj); });
    canvas.toBlob(function (blob) {
      if (!blob) {
        toast('导出失败，请重试', 'error');
        return;
      }
      U.download(blob, U.safeFilename(state.title, 'inkboard') + '-' + U.formatFileTime() + '.png');
      toast('PNG 图片已导出');
    }, 'image/png');
  }

  function exportJson() {
    const data = {
      app: 'InkBoard',
      version: 1,
      title: state.title,
      board: state.board,
      objects: state.objects,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    U.download(blob, U.safeFilename(state.title, 'inkboard') + '-' + U.formatFileTime() + '.json');
    toast('JSON 源文件已导出');
  }

  async function importJsonFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.objects)) throw new Error('bad data');
      const objects = data.objects.filter(isValidObject);
      const ok = await confirmDialog('导入 JSON 备份？', '将载入 ' + objects.length + ' 个对象并替换当前画板，画板尺寸和名称也会一起恢复。', '导入');
      if (!ok) return;
      cancelTextEditor();
      state.objects = objects;
      state.board = Store.normalizeBoard(data.board);
      state.title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '导入的白板';
      state.selection.clear();
      state.editingId = null;
      history.past = [];
      history.future = [];
      updateHistoryButtons();
      dom.docTitle.value = state.title;
      updateDocumentTitle();
      setupCanvas();
      fitBoard();
      renderBoardPresets();
      syncBoardUI();
      updateEmptyState();
      scheduleAutosave();
      saveNow(true);
      requestRender();
      toast('已导入 ' + objects.length + ' 个对象');
    } catch (err) {
      toast('导入失败，文件不是有效的墨板 JSON', 'error');
    }
  }

  async function clearBoard() {
    if (!state.objects.length) {
      toast('画板已经是空的');
      return;
    }
    const ok = await confirmDialog('清空画板？', '画板上的所有内容会被移除，但可以用 Ctrl + Z 撤销；也可以先在“存档”里保存快照。', '清空', true);
    if (!ok) return;
    commitChange(function () {
      state.objects = [];
      state.selection.clear();
    });
    toast('画板已清空，可撤销');
  }

  /* ==========================================================================
     计时器
     ========================================================================== */

  function ensureAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function playAlarm() {
    if (!settings.sound) return;
    const ac = ensureAudio();
    if (!ac) return;
    const start = ac.currentTime + 0.03;
    for (let i = 0; i < 4; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      const t = start + i * 0.32;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  function onTimerFinish() {
    playAlarm();
    toast('倒计时结束，时间到！', 'timer');
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('墨板 · 时间到', { body: '倒计时已经结束' }); } catch (err) { /* ignore */ }
    }
  }

  function startLabelFor(snapshot) {
    if (snapshot.running) return '暂停';
    if (snapshot.done) return '重新开始';
    if (snapshot.mode === 'stopwatch') return snapshot.elapsed > 500 ? '继续' : '开始';
    return snapshot.remaining < snapshot.total - 500 ? '继续' : '开始';
  }

  function updateTimerUI(snapshot) {
    if (!dom.timerDisplay) return;
    const s = snapshot || (timer ? timer.snapshot() : null);
    if (!s) return;
    let display;
    let sub;
    if (s.mode === 'stopwatch') {
      display = U.formatDuration(s.elapsed);
      sub = s.running ? '秒表 · 计时中' : s.elapsed > 0 ? '秒表 · 已暂停' : '秒表 · 正计时';
    } else if (s.done) {
      display = '时间到';
      sub = '倒计时结束';
    } else {
      display = U.formatDuration(Math.ceil(Math.max(0, s.remaining) / 1000) * 1000);
      const total = U.formatDuration(Math.ceil(s.total / 1000) * 1000);
      sub = s.running ? '倒计时 · 进行中' : s.remaining < s.total ? '倒计时 · 已暂停' : '倒计时 · ' + total;
    }
    const progress = s.mode === 'countdown' ? Math.max(0, Math.min(100, s.progress * 100)) : s.running || s.elapsed > 0 ? 100 : 0;
    dom.timerDisplay.textContent = display;
    dom.timerSub.textContent = sub;
    dom.timerProgress.style.width = progress + '%';
    dom.timerCard.classList.toggle('running', s.running);
    dom.timerCard.classList.toggle('done', s.done);
    dom.timerBadge.textContent = s.done ? '结束' : s.running ? '运行中' : '待机';

    const label = startLabelFor(s);
    const key = s.mode + '|' + label;
    if (dom.timerStart.dataset.key !== key) {
      dom.timerStart.dataset.key = key;
      dom.timerStart.innerHTML = icon(s.running ? 'pause' : 'play') + '<span>' + label + '</span>';
    }

    dom.floatingTimer.classList.toggle('done', s.done);
    dom.floatTimerLabel.textContent = s.mode === 'stopwatch' ? '秒表' : '倒计时';
    dom.floatTimerTime.textContent = s.done ? '时间到' : display;
    const fkey = s.mode + '|' + label;
    if (dom.floatTimerToggle.dataset.key !== fkey) {
      dom.floatTimerToggle.dataset.key = fkey;
      dom.floatTimerToggle.innerHTML = icon(s.running ? 'pause' : 'play') + '<span>' + label + '</span>';
    }
  }

  function syncCountdownInputs() {
    const ms = settings.countdownMs || 25 * 60000;
    const totalSeconds = Math.floor(ms / 1000);
    dom.cdHours.value = Math.floor(totalSeconds / 3600);
    dom.cdMinutes.value = Math.floor((totalSeconds % 3600) / 60);
    dom.cdSeconds.value = totalSeconds % 60;
  }

  function applyCountdownDuration(ms, announce) {
    const total = U.clamp(Math.round(ms), 1000, 24 * 3600 * 1000);
    settings.countdownMs = total;
    Store.saveSettings(settings);
    timer.setCountdown(total);
    syncCountdownInputs();
    updateTimerUI(timer.snapshot());
    if (announce) toast('倒计时设为 ' + U.formatDuration(total));
  }

  function setCountdownFromInputs() {
    const h = U.clamp(parseInt(dom.cdHours.value, 10) || 0, 0, 23);
    const m = U.clamp(parseInt(dom.cdMinutes.value, 10) || 0, 0, 59);
    const sec = U.clamp(parseInt(dom.cdSeconds.value, 10) || 0, 0, 59);
    const ms = (h * 3600 + m * 60 + sec) * 1000;
    if (ms < 1000) {
      toast('倒计时至少需要 1 秒', 'error');
      return;
    }
    applyCountdownDuration(ms, true);
    if (timer.mode !== 'countdown') setTimerMode('countdown');
  }

  function setTimerMode(mode) {
    timer.setMode(mode);
    document.querySelectorAll('#timerMode button').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    dom.countdownSetup.hidden = mode !== 'countdown';
    updateTimerUI(timer.snapshot());
  }

  function updateFloatingTimerVisibility() {
    dom.floatingTimer.hidden = !settings.showFloatingTimer;
    dom.floatingTimerToggle.checked = settings.showFloatingTimer;
    if (settings.showFloatingTimer) updateTimerUI(timer ? timer.snapshot() : null);
  }

  /* ==========================================================================
     时钟
     ========================================================================== */

  function tickClock() {
    const value = U.formatClock(new Date(), settings.clock24, settings.showSeconds);
    dom.clockTime.textContent = value.time;
    dom.clockDate.textContent = value.date;
  }

  /* ==========================================================================
     配色夹事件 / 画板事件
     ========================================================================== */

  function initPaletteEvents() {
    dom.builtinFolders.addEventListener('click', handlePaletteClick);
    dom.userFolders.addEventListener('click', handlePaletteClick);
    dom.recentColors.addEventListener('click', function (event) {
      const swatch = event.target.closest('.swatch');
      if (swatch && swatch.dataset.color) setColor(swatch.dataset.color, true);
    });
    dom.clearRecent.addEventListener('click', function () {
      state.palette.recent = [];
      Store.savePalette(state.palette);
      renderRecent();
    });
    dom.newFolderBtn.addEventListener('click', createFolder);

    dom.colorInput.addEventListener('input', function (event) {
      setColor(event.target.value, false);
    });
    dom.colorInput.addEventListener('change', function (event) {
      setColor(event.target.value, true);
    });
    dom.hexInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        dom.hexInput.blur();
      }
    });
    dom.hexInput.addEventListener('blur', function () {
      const hex = U.normalizeHex(dom.hexInput.value);
      if (hex) setColor(hex, true);
      else dom.hexInput.value = state.color.slice(1).toUpperCase();
    });
    dom.widthRange.addEventListener('input', function (event) {
      setWidth(event.target.value);
    });
    dom.textSizeRange.addEventListener('input', function (event) {
      setTextSize(event.target.value);
    });
  }

  function initBoardEvents() {
    renderBoardPresets();
    dom.boardPresets.addEventListener('click', function (event) {
      const swatch = event.target.closest('[data-board-bg]');
      if (swatch) setBoardBg(swatch.dataset.boardBg);
    });
    dom.boardColorInput.addEventListener('input', function (event) {
      setBoardBg(event.target.value);
    });
    dom.patternGroup.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-pattern]');
      if (!btn) return;
      state.board.pattern = btn.dataset.pattern;
      syncBoardUI();
      requestRender();
      scheduleAutosave();
    });
    dom.applySize.addEventListener('click', function () {
      applyBoardSize(dom.boardW.value, dom.boardH.value);
    });
    [dom.boardW, dom.boardH].forEach(function (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') applyBoardSize(dom.boardW.value, dom.boardH.value);
      });
    });
    dom.sizePresets.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-w]');
      if (!btn) return;
      dom.boardW.value = btn.dataset.w;
      dom.boardH.value = btn.dataset.h;
      applyBoardSize(btn.dataset.w, btn.dataset.h);
    });
    dom.fitBoardBtn.addEventListener('click', fitBoard);

    dom.zoomIn.addEventListener('click', function () { setZoom(state.zoom * 1.25); });
    dom.zoomOut.addEventListener('click', function () { setZoom(state.zoom / 1.25); });
    dom.zoomReset.addEventListener('click', function () { setZoom(1); });
    dom.zoomLabel.addEventListener('click', function () { setZoom(1); });
    dom.zoomFit.addEventListener('click', fitBoard);

    dom.viewport.addEventListener('wheel', function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(state.zoom * Math.exp(-event.deltaY * 0.0022), event);
    }, { passive: false });

    let resizeFrame = 0;
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(function () {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(function () {
          if (state.zoomMode === 'fit') fitBoard();
          else {
            applyZoomSize();
            requestRender();
          }
        });
      });
      ro.observe(dom.viewport);
    }
  }

  function initSettingsEvents() {
    dom.themePresets.addEventListener('click', function (event) {
      const swatch = event.target.closest('[data-theme-color]');
      if (swatch) setThemeColor(swatch.dataset.themeColor);
    });
    dom.themeColorInput.addEventListener('input', function (event) {
      setThemeColor(event.target.value);
    });
    dom.themeModeBtn.addEventListener('click', function () {
      settings.dark = !settings.dark;
      Store.saveSettings(settings);
      applyTheme();
      requestRender();
    });
    dom.darkToggle.addEventListener('change', function (event) {
      settings.dark = event.target.checked;
      Store.saveSettings(settings);
      applyTheme();
      requestRender();
    });
    dom.clock24Toggle.addEventListener('change', function (event) {
      settings.clock24 = event.target.checked;
      Store.saveSettings(settings);
      tickClock();
    });
    dom.secondsToggle.addEventListener('change', function (event) {
      settings.showSeconds = event.target.checked;
      Store.saveSettings(settings);
      tickClock();
    });
    dom.soundToggle.addEventListener('change', function (event) {
      settings.sound = event.target.checked;
      Store.saveSettings(settings);
      if (settings.sound) ensureAudio();
    });
    dom.autosaveToggle.addEventListener('change', function (event) {
      settings.autosave = event.target.checked;
      Store.saveSettings(settings);
      updateAutosaveCard();
      if (settings.autosave) {
        scheduleAutosave();
      } else {
        setSaveState('自动保存已关闭', 'off');
      }
    });
    dom.floatingTimerToggle.addEventListener('change', function (event) {
      settings.showFloatingTimer = event.target.checked;
      Store.saveSettings(settings);
      updateFloatingTimerVisibility();
    });
    dom.helpBtn.addEventListener('click', showHelp);
    dom.helpBtn2.addEventListener('click', showHelp);
    dom.resetSettingsBtn.addEventListener('click', resetSettings);
  }

  async function resetSettings() {
    const ok = await confirmDialog('恢复默认设置？', '主题色、时钟、提示音与界面偏好会恢复默认；画板内容、保存的快照和颜色夹都不会受影响。', '恢复默认');
    if (!ok) return;
    const defaults = Store.DEFAULT_SETTINGS;
    Object.keys(defaults).forEach(function (key) { settings[key] = defaults[key]; });
    Store.saveSettings(settings);
    applyTheme();
    syncSettingsUI();
    setColor(settings.color, false);
    setWidth(settings.width);
    setTextSize(settings.textSize);
    setFill(settings.fill);
    applyCountdownDuration(settings.countdownMs, false);
    updateFloatingTimerVisibility();
    updateAutosaveCard();
    tickClock();
    requestRender();
    toast('已恢复默认设置');
  }

  function syncSettingsUI() {
    dom.darkToggle.checked = settings.dark;
    dom.clock24Toggle.checked = settings.clock24;
    dom.secondsToggle.checked = settings.showSeconds;
    dom.soundToggle.checked = settings.sound;
    dom.autosaveToggle.checked = settings.autosave;
    dom.floatingTimerToggle.checked = settings.showFloatingTimer;
    dom.themeColorInput.value = settings.themeColor;
    dom.themeHex.textContent = settings.themeColor.toUpperCase();
  }

  function initTimerEvents() {
    dom.timerMode.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-mode]');
      if (btn) setTimerMode(btn.dataset.mode);
    });
    dom.timerStart.addEventListener('click', function () {
      ensureAudio();
      timer.toggle();
      updateTimerUI(timer.snapshot());
    });
    dom.timerReset.addEventListener('click', function () {
      timer.reset();
      updateTimerUI(timer.snapshot());
    });
    dom.floatTimerToggle.addEventListener('click', function () {
      ensureAudio();
      timer.toggle();
      updateTimerUI(timer.snapshot());
    });
    dom.floatTimerReset.addEventListener('click', function () {
      timer.reset();
      updateTimerUI(timer.snapshot());
    });
    dom.floatTimerClose.addEventListener('click', function () {
      settings.showFloatingTimer = false;
      Store.saveSettings(settings);
      updateFloatingTimerVisibility();
    });
    dom.cdPresets.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-min]');
      if (!btn) return;
      const minutes = Number(btn.dataset.min) || 25;
      dom.cdHours.value = Math.floor(minutes / 60);
      dom.cdMinutes.value = minutes % 60;
      dom.cdSeconds.value = 0;
      applyCountdownDuration(minutes * 60000, true);
    });
    dom.applyCountdown.addEventListener('click', setCountdownFromInputs);
    [dom.cdHours, dom.cdMinutes, dom.cdSeconds].forEach(function (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') setCountdownFromInputs();
      });
    });

    dom.ftHead.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      const parent = dom.canvasArea.getBoundingClientRect();
      const rect = dom.floatingTimer.getBoundingClientRect();
      ftDrag = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        pointerId: event.pointerId
      };
      dom.floatingTimer.style.right = 'auto';
      dom.floatingTimer.style.left = (rect.left - parent.left) + 'px';
      dom.floatingTimer.style.top = (rect.top - parent.top) + 'px';
      try { dom.ftHead.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    });
    dom.ftHead.addEventListener('pointermove', function (event) {
      if (!ftDrag || ftDrag.pointerId !== event.pointerId) return;
      const parent = dom.canvasArea.getBoundingClientRect();
      const ft = dom.floatingTimer.getBoundingClientRect();
      let left = event.clientX - parent.left - ftDrag.dx;
      let top = event.clientY - parent.top - ftDrag.dy;
      left = U.clamp(left, 8, parent.width - ft.width - 8);
      top = U.clamp(top, 8, parent.height - ft.height - 8);
      dom.floatingTimer.style.left = left + 'px';
      dom.floatingTimer.style.top = top + 'px';
    });
    dom.ftHead.addEventListener('pointerup', function (event) {
      ftDrag = null;
      try { dom.ftHead.releasePointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    });
  }

  function initSaveEvents() {
    dom.saveNowBtn.addEventListener('click', function () { saveNow(false); });
    dom.saveSnapshotBtn.addEventListener('click', saveSnapshot);
    dom.snapName.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') saveSnapshot();
    });
    dom.savesList.addEventListener('click', function (event) {
      const loadBtn = event.target.closest('[data-load-save]');
      if (loadBtn) {
        loadSnapshot(loadBtn.dataset.loadSave);
        return;
      }
      const delBtn = event.target.closest('[data-delete-save]');
      if (delBtn) deleteSnapshot(delBtn.dataset.deleteSave);
    });
    dom.exportPngBtn.addEventListener('click', exportPng);
    dom.exportJsonBtn.addEventListener('click', exportJson);
    dom.importJsonBtn.addEventListener('click', function () { dom.importFile.click(); });
    dom.importFile.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (file) importJsonFile(file);
    });
    dom.clearBoardBtn2.addEventListener('click', clearBoard);
    dom.clearBtn.addEventListener('click', clearBoard);
  }

  function openExportMenu() {
    const menu = document.createElement('div');
    menu.className = 'popover menu-popover';
    menu.innerHTML =
      '<button class="menu-item" data-action="png">' + icon('image') + '导出 PNG 图片<span class="menu-key">.png</span></button>' +
      '<button class="menu-item" data-action="json">' + icon('code') + '导出 JSON 源文件<span class="menu-key">.json</span></button>' +
      '<div class="menu-sep"></div>' +
      '<button class="menu-item" data-action="import">' + icon('upload') + '导入 JSON 备份</button>' +
      '<button class="menu-item" data-action="snapshot">' + icon('save') + '保存到快照列表</button>' +
      '<button class="menu-item" data-action="save">' + icon('check') + '立即缓存到本机<span class="menu-key">Ctrl S</span></button>';
    menu.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      closePopover();
      const action = btn.dataset.action;
      if (action === 'png') exportPng();
      else if (action === 'json') exportJson();
      else if (action === 'import') dom.importFile.click();
      else if (action === 'snapshot') saveSnapshot();
      else if (action === 'save') saveNow(false);
    });
    dom.topExportBtn.style.position = 'relative';
    openPopover(menu, dom.topExportBtn, true);
  }

  /* ==========================================================================
     图形选择器
     ========================================================================== */

  function openShapePicker(kind, anchor) {
    const list = kind === '3d' ? S.SHAPES_3D : S.SHAPES_2D;
    const popover = document.createElement('div');
    popover.className = 'popover shape-popover';
    popover.innerHTML =
      '<div class="popover-head"><strong>' + (kind === '3d' ? '3D 立体图形' : '基础图形') + '</strong><span>选中后在画板拖动</span></div>' +
      '<div class="shape-grid' + (kind === '3d' ? ' three-d' : '') + '">' +
      list.map(function (shape) {
        return '<button class="shape-opt' + (state.tool === shape.type ? ' active' : '') + '" data-shape="' + shape.type + '" title="' + shape.label + '">' +
          '<canvas data-preview="' + shape.type + '" width="128" height="96"></canvas>' +
          '<span>' + shape.label + '</span></button>';
      }).join('') +
      '</div>';
    openPopover(popover, anchor, false);
    popover.querySelectorAll('canvas[data-preview]').forEach(function (canvas) {
      const c = canvas.getContext('2d');
      c.scale(2, 2);
      S.drawObject(c, S.sampleObject(canvas.dataset.preview));
    });
    popover.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-shape]');
      if (!btn) return;
      setTool(btn.dataset.shape);
      closePopover();
    });
  }

  /* ==========================================================================
     键盘
     ========================================================================== */

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function onKeyDown(event) {
    if (dom.modalRoot.children.length > 0) return;
    if (event.key === 'Escape') {
      if (activePopover) closePopover();
      else if (state.textEditor) cancelTextEditor();
      else if (state.selection.size) {
        state.selection.clear();
        updateSelectionBar();
        requestRender();
      }
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (state.gesture) return;

    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    const lower = key.toLowerCase();

    if (mod && lower === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && lower === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && lower === 's') {
      event.preventDefault();
      saveNow(false);
      return;
    }
    if (mod && lower === 'd') {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (mod && lower === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (state.selection.size) {
        event.preventDefault();
        deleteSelection();
      }
      return;
    }
    if (key.indexOf('Arrow') === 0) {
      if (!state.selection.size) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      if (key === 'ArrowLeft') nudgeSelection(-step, 0);
      else if (key === 'ArrowRight') nudgeSelection(step, 0);
      else if (key === 'ArrowUp') nudgeSelection(0, -step);
      else if (key === 'ArrowDown') nudgeSelection(0, step);
      return;
    }
    if (key === '[') {
      if (state.selection.size) {
        event.preventDefault();
        sendSelectionToBack();
      }
      return;
    }
    if (key === ']') {
      if (state.selection.size) {
        event.preventDefault();
        bringSelectionToFront();
      }
      return;
    }
    if (key === '?') {
      event.preventDefault();
      showHelp();
      return;
    }
    if (mod || event.altKey) return;
    if (lower === 'v') setTool('select');
    else if (lower === 'p') setTool('pen');
    else if (lower === 'e') setTool('eraser');
    else if (lower === 't') setTool('text');
  }

  /* ==========================================================================
     初始化
     ========================================================================== */

  function updateEmptyState() {
    const hasContent = state.objects.length > 0 || !!state.textEditor;
    dom.canvasHint.classList.toggle('hide', hasContent);
  }

  function bindCanvasEvents() {
    dom.canvas.addEventListener('pointerdown', onPointerDown);
    dom.canvas.addEventListener('pointermove', onPointerMove);
    dom.canvas.addEventListener('pointerup', onPointerUp);
    dom.canvas.addEventListener('pointercancel', onPointerCancel);
    dom.canvas.addEventListener('pointerleave', onPointerLeave);
    dom.canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    dom.stage.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    dom.canvas.addEventListener('dblclick', function (event) {
      if (state.tool !== 'select' || state.textEditor) return;
      const point = toBoard(event);
      const obj = objectAt(point.x, point.y);
      if (obj && obj.type === 'text') {
        event.preventDefault();
        openTextEditor({ x: obj.x, y: obj.y }, obj);
      }
    });
  }

  function bindUiEvents() {
    document.querySelectorAll('.panel-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const name = tab.dataset.tab;
        document.querySelectorAll('.panel-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
        document.querySelectorAll('.panel[data-panel]').forEach(function (panel) {
          panel.classList.toggle('active', panel.dataset.panel === name);
        });
        dom.panelScroll.scrollTop = 0;
      });
    });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(function (btn) {
      btn.addEventListener('click', function () { setTool(btn.dataset.tool); });
    });
    dom.shapeBtn.addEventListener('click', function () { openShapePicker('2d', dom.shapeBtn); });
    dom.shape3dBtn.addEventListener('click', function () { openShapePicker('3d', dom.shape3dBtn); });
    dom.undoBtn.addEventListener('click', undo);
    dom.redoBtn.addEventListener('click', redo);
    dom.selDuplicate.addEventListener('click', duplicateSelection);
    dom.selFront.addEventListener('click', bringSelectionToFront);
    dom.selBack.addEventListener('click', sendSelectionToBack);
    dom.selDelete.addEventListener('click', deleteSelection);
    dom.fillToggle.addEventListener('click', function () { setFill(!state.fill); });
    dom.docTitle.addEventListener('input', function () {
      state.title = dom.docTitle.value.trim() || '未命名白板';
      updateDocumentTitle();
      scheduleAutosave();
    });
    dom.docTitle.addEventListener('blur', function () {
      if (!dom.docTitle.value.trim()) {
        dom.docTitle.value = '未命名白板';
        state.title = '未命名白板';
      }
      updateDocumentTitle();
    });
    dom.topExportBtn.addEventListener('click', openExportMenu);
    dom.panelToggle.addEventListener('click', function () {
      dom.sidepanel.classList.toggle('open');
    });
    document.addEventListener('pointerdown', function (event) {
      if (window.innerWidth > 920) return;
      if (!dom.sidepanel.classList.contains('open')) return;
      if (dom.sidepanel.contains(event.target) || dom.panelToggle.contains(event.target)) return;
      dom.sidepanel.classList.remove('open');
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', function () {
      if (settings.autosave) saveNow(true);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && settings.autosave) saveNow(true);
    });
  }

  function init() {
    dom.docTitle.value = state.title;
    updateDocumentTitle();
    applyTheme();
    syncSettingsUI();

    setColor(state.color, false);
    setWidth(state.width);
    setTextSize(state.textSize);
    setFill(state.fill);
    renderPalette();
    renderRecent();
    renderBoardPresets();
    syncBoardUI();

    timer = new TimerEngine({
      countdownMs: settings.countdownMs,
      onTick: updateTimerUI,
      onFinish: onTimerFinish
    });
    syncCountdownInputs();
    setTimerMode('stopwatch');
    if (settings.countdownMs) timer.setCountdown(settings.countdownMs);
    updateTimerUI(timer.snapshot());
    updateFloatingTimerVisibility();

    bindCanvasEvents();
    bindUiEvents();
    initPaletteEvents();
    initBoardEvents();
    initSettingsEvents();
    initTimerEvents();
    initSaveEvents();

    setupCanvas();
    updateHistoryButtons();
    updateEmptyState();
    updateAutosaveCard();
    updateSelectionBar();
    setTool('pen');
    tickClock();
    setInterval(tickClock, 1000);

    if (state.lastSaved && settings.autosave) {
      setSaveState('上次缓存 ' + formatShortTime(state.lastSaved));
    } else if (!settings.autosave) {
      setSaveState('自动保存已关闭', 'off');
    } else {
      setSaveState('本地自动缓存');
    }

    renderSaves();
    updateToolOptions();

    requestAnimationFrame(function () {
      fitBoard();
      requestRender();
    });
  }

  init();
})();
