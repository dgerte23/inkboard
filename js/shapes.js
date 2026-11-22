/* InkBoard · 图形绘制引擎（2D 图形 / 3D 立体 / 手绘笔画） */
(function (global) {
  'use strict';
  const IB = (global.IB = global.IB || {});
  const U = IB.util;
  const S = {};
  const TAU = Math.PI * 2;
  const FONT_STACK = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Segoe UI",system-ui,sans-serif';

  S.SHAPES_2D = [
    { type: 'line', label: '直线' },
    { type: 'arrow', label: '箭头' },
    { type: 'rect', label: '矩形' },
    { type: 'ellipse', label: '圆形' },
    { type: 'triangle', label: '三角形' },
    { type: 'diamond', label: '菱形' },
    { type: 'star', label: '五角星' },
    { type: 'pentagon', label: '五边形' },
    { type: 'hexagon', label: '六边形' },
    { type: 'bubble', label: '对话气泡' }
  ];

  S.SHAPES_3D = [
    { type: 'cube', label: '立方体' },
    { type: 'cuboid', label: '长方体' },
    { type: 'cylinder', label: '圆柱体' },
    { type: 'sphere', label: '球体' },
    { type: 'pyramid', label: '金字塔' },
    { type: 'cone', label: '圆锥体' },
    { type: 'hexprism', label: '六棱柱' }
  ];

  const SHAPE_TYPES = new Set(
    S.SHAPES_2D.map(function (s) { return s.type; }).concat(S.SHAPES_3D.map(function (s) { return s.type; }))
  );

  S.isShapeType = function (type) { return SHAPE_TYPES.has(type); };
  S.is3D = function (type) { return S.SHAPES_3D.some(function (s) { return s.type === type; }); };
  S.labelFor = function (type) {
    const all = S.SHAPES_2D.concat(S.SHAPES_3D);
    const found = all.find(function (s) { return s.type === type; });
    return found ? found.label : '图形';
  };

  let measureCtx = null;
  function getMeasureCtx() {
    if (!measureCtx) {
      const c = document.createElement('canvas');
      measureCtx = c.getContext('2d');
    }
    return measureCtx;
  }

  S.font = function (size, weight) {
    return (weight || 500) + ' ' + Math.max(1, size) + 'px ' + FONT_STACK;
  };

  function normRect(o) {
    const x = Math.min(o.x1, o.x2);
    const y = Math.min(o.y1, o.y2);
    return { x: x, y: y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function regularPolygon(cx, cy, rx, ry, sides, rotation) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (rotation == null ? -Math.PI / 2 : rotation) + i * TAU / sides;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
  }

  function starPoints(cx, cy, rx, ry, points) {
    const pts = [];
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const a = -Math.PI / 2 + i * TAU / total;
      const k = i % 2 === 0 ? 1 : 0.42;
      pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
    }
    return pts;
  }

  function polygonPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  function fillAndStroke(ctx, color, width, filled) {
    if (filled) {
      ctx.fillStyle = U.alpha(color, 0.15);
      ctx.fill();
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function drawStroke(ctx, obj) {
    const pts = obj.points || [];
    if (!pts.length) return;
    ctx.strokeStyle = obj.color || '#111827';
    ctx.fillStyle = obj.color || '#111827';
    ctx.lineWidth = Math.max(0.5, obj.width || 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, Math.max(0.6, ctx.lineWidth / 2), 0, TAU);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  }

  S.textMetrics = function (obj) {
    const size = Math.max(1, obj.size || 32);
    const lines = String(obj.text == null ? '' : obj.text).split('\n');
    const mctx = getMeasureCtx();
    mctx.font = S.font(size);
    let width = 0;
    lines.forEach(function (line) {
      width = Math.max(width, mctx.measureText(line || ' ').width);
    });
    const lineHeight = size * 1.3;
    return {
      lines: lines,
      width: width,
      height: Math.max(lineHeight, lines.length * lineHeight),
      lineHeight: lineHeight
    };
  };

  function drawText(ctx, obj) {
    const size = Math.max(1, obj.size || 32);
    const m = S.textMetrics(obj);
    ctx.font = S.font(size);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = obj.color || '#111827';
    m.lines.forEach(function (line, i) {
      ctx.fillText(line, obj.x, obj.y + i * m.lineHeight);
    });
  }

  function drawLine(ctx, obj) {
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();
  }

  function drawArrow(ctx, obj) {
    const dx = obj.x2 - obj.x1;
    const dy = obj.y2 - obj.y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const angle = Math.atan2(dy, dx);
    const head = Math.min(Math.max(11, (obj.width || 3) * 3.2), len * 0.55);
    const spread = 0.42;
    const p1 = { x: obj.x2 - Math.cos(angle - spread) * head, y: obj.y2 - Math.sin(angle - spread) * head };
    const p2 = { x: obj.x2 - Math.cos(angle + spread) * head, y: obj.y2 - Math.sin(angle + spread) * head };
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(obj.x2, obj.y2);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fillStyle = obj.color;
    ctx.fill();
  }

  function drawBubble(ctx, obj, width, filled) {
    const r = normRect(obj);
    const x = r.x, y = r.y, w = Math.max(r.w, 6), h = Math.max(r.h, 6);
    const bodyH = Math.max(8, h * 0.78);
    const radius = Math.min(16, w * 0.18, bodyH * 0.28);
    const tailX = x + Math.min(w * 0.22, 52);
    const tailW = Math.min(w * 0.16, 34);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + bodyH - radius);
    ctx.quadraticCurveTo(x + w, y + bodyH, x + w - radius, y + bodyH);
    ctx.lineTo(tailX + tailW, y + bodyH);
    ctx.lineTo(tailX + tailW * 0.45, y + h);
    ctx.lineTo(tailX, y + bodyH);
    ctx.lineTo(x + radius, y + bodyH);
    ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    fillAndStroke(ctx, obj.color, width, filled);
  }

  function drawCube(ctx, obj, width, depthRatio) {
    const r = normRect(obj);
    if (r.w < 4 || r.h < 4) return;
    const d = Math.max(4, Math.min(r.w, r.h) * depthRatio);
    const fx = r.x, fy = r.y + d;
    const fw = Math.max(1, r.w - d), fh = Math.max(1, r.h - d);
    const color = obj.color;
    const outline = U.shade(color, -0.36);
    ctx.lineWidth = width;
    ctx.strokeStyle = outline;
    // 正面
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.fill();
    ctx.stroke();
    // 顶面
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + d, r.y);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.lineTo(r.x + r.w - d, fy);
    ctx.closePath();
    ctx.fillStyle = U.shade(color, 0.34);
    ctx.fill();
    ctx.stroke();
    // 右侧面
    ctx.beginPath();
    ctx.moveTo(r.x + r.w - d, fy);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.lineTo(r.x + r.w, r.y + r.h - d);
    ctx.lineTo(r.x + r.w - d, r.y + r.h);
    ctx.closePath();
    ctx.fillStyle = U.shade(color, -0.18);
    ctx.fill();
    ctx.stroke();
  }

  function drawCylinder(ctx, obj, width) {
    const r = normRect(obj);
    if (r.w < 4 || r.h < 4) return;
    const color = obj.color;
    const rx = r.w / 2;
    const ry = Math.min(r.h * 0.17, r.w * 0.26);
    const cx = r.x + rx;
    const topY = r.y + ry;
    const botY = r.y + r.h - ry;
    const outline = U.shade(color, -0.34);
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(r.x, topY);
    ctx.lineTo(r.x, botY);
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    grad.addColorStop(0, U.shade(color, 0.26));
    grad.addColorStop(0.48, color);
    grad.addColorStop(1, U.shade(color, -0.2));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, TAU);
    ctx.fillStyle = U.shade(color, 0.32);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
    ctx.strokeStyle = U.shade(color, -0.28);
    ctx.stroke();
  }

  function drawSphere(ctx, obj, width) {
    const r = normRect(obj);
    if (r.w < 4 || r.h < 4) return;
    const color = obj.color;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rx = r.w / 2;
    const ry = r.h / 2;
    const grad = ctx.createRadialGradient(
      r.x + r.w * 0.34, r.y + r.h * 0.28, Math.min(r.w, r.h) * 0.04,
      cx, cy, Math.max(rx, ry) * 0.95
    );
    grad.addColorStop(0, U.shade(color, 0.58));
    grad.addColorStop(0.42, color);
    grad.addColorStop(1, U.shade(color, -0.34));
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = U.shade(color, -0.3);
    ctx.stroke();
  }

  function drawPyramid(ctx, obj, width) {
    const r = normRect(obj);
    if (r.w < 4 || r.h < 4) return;
    const color = obj.color;
    const outline = U.shade(color, -0.36);
    const ry = Math.min(r.h * 0.18, r.w * 0.22);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h - ry;
    const apex = { x: cx, y: r.y };
    const left = { x: r.x, y: cy };
    const right = { x: r.x + r.w, y: cy };
    const front = { x: cx, y: cy + ry };
    const back = { x: cx, y: cy - ry };
    ctx.lineWidth = width;
    ctx.strokeStyle = outline;
    // 底座
    polygonPath(ctx, [left, back, right, front]);
    ctx.fillStyle = U.shade(color, -0.08);
    ctx.fill();
    ctx.stroke();
    // 可见侧面
    polygonPath(ctx, [apex, left, front]);
    ctx.fillStyle = U.shade(color, 0.04);
    ctx.fill();
    ctx.stroke();
    polygonPath(ctx, [apex, front, right]);
    ctx.fillStyle = U.shade(color, -0.22);
    ctx.fill();
    ctx.stroke();
  }

  function drawCone(ctx, obj, width) {
    const r = normRect(obj);
    if (r.w < 4 || r.h < 4) return;
    const color = obj.color;
    const outline = U.shade(color, -0.34);
    const ry = Math.min(r.h * 0.16, r.w * 0.24);
    const cx = r.x + r.w / 2;
    const bx = r.x;
    const brx = r.w / 2;
    const by = r.y + r.h - ry;
    const apex = { x: cx, y: r.y };
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(bx, by);
    ctx.ellipse(cx, by, brx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(apex.x, apex.y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    grad.addColorStop(0, U.shade(color, 0.3));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, U.shade(color, -0.22));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, by, brx, ry, 0, Math.PI, 0, true);
    ctx.strokeStyle = U.shade(color, -0.28);
    ctx.stroke();
  }

  function hexPoints(cx, cy, rx, ry) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + Math.PI / 6;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
  }

  function drawHexPrism(ctx, obj, width) {
    const r = normRect(obj);
    if (r.w < 6 || r.h < 6) return;
    const color = obj.color;
    const outline = U.shade(color, -0.38);
    const rx = r.w / 2;
    const ry = Math.min(r.h * 0.13, r.w * 0.19);
    const cx = r.x + rx;
    const topCy = r.y + ry;
    const botCy = r.y + r.h - ry;
    const top = hexPoints(cx, topCy, rx, ry);
    const bot = hexPoints(cx, botCy, rx, ry);
    ctx.lineWidth = width;
    ctx.strokeStyle = outline;

    for (let i = 0; i < 6; i++) {
      const p1 = top[i];
      const p2 = top[(i + 1) % 6];
      const p3 = bot[(i + 1) % 6];
      const p4 = bot[i];
      const midX = (p1.x + p2.x) / 2;
      const rel = (midX - cx) / rx;
      const shade = -0.1 + rel * 0.12;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = U.shade(color, shade);
      ctx.fill();
      ctx.stroke();
    }

    polygonPath(ctx, top);
    ctx.fillStyle = U.shade(color, 0.34);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = U.shade(color, -0.25);
    ctx.beginPath();
    ctx.ellipse(cx, botCy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }

  S.drawObject = function (ctx, obj) {
    if (!obj) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const width = Math.max(0.5, obj.width || 3);
    ctx.lineWidth = width;
    ctx.strokeStyle = obj.color || '#111827';
    ctx.fillStyle = obj.color || '#111827';

    if (obj.type === 'stroke') {
      drawStroke(ctx, obj);
    } else if (obj.type === 'text') {
      drawText(ctx, obj);
    } else if (obj.type === 'line') {
      drawLine(ctx, obj);
    } else if (obj.type === 'arrow') {
      drawArrow(ctx, obj);
    } else if (S.isShapeType(obj.type)) {
      const r = normRect(obj);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      if (obj.type === 'rect') {
        ctx.beginPath();
        ctx.rect(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h));
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, TAU);
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'triangle') {
        polygonPath(ctx, [
          { x: cx, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h }
        ]);
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'diamond') {
        polygonPath(ctx, [
          { x: cx, y: r.y },
          { x: r.x + r.w, y: cy },
          { x: cx, y: r.y + r.h },
          { x: r.x, y: cy }
        ]);
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'star') {
        polygonPath(ctx, starPoints(cx, cy, r.w / 2, r.h / 2, 5));
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'pentagon') {
        polygonPath(ctx, regularPolygon(cx, cy, r.w / 2, r.h / 2, 5, -Math.PI / 2));
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'hexagon') {
        polygonPath(ctx, regularPolygon(cx, cy, r.w / 2, r.h / 2, 6, Math.PI / 6));
        fillAndStroke(ctx, obj.color, width, obj.fill);
      } else if (obj.type === 'bubble') {
        drawBubble(ctx, obj, width, obj.fill);
      } else if (obj.type === 'cube' || obj.type === 'cuboid') {
        drawCube(ctx, obj, width, obj.type === 'cube' ? 0.3 : 0.2);
      } else if (obj.type === 'cylinder') {
        drawCylinder(ctx, obj, width);
      } else if (obj.type === 'sphere') {
        drawSphere(ctx, obj, width);
      } else if (obj.type === 'pyramid') {
        drawPyramid(ctx, obj, width);
      } else if (obj.type === 'cone') {
        drawCone(ctx, obj, width);
      } else if (obj.type === 'hexprism') {
        drawHexPrism(ctx, obj, width);
      }
    }
    ctx.restore();
  };

  S.bounds = function (obj) {
    if (!obj) return { x: 0, y: 0, w: 0, h: 0 };
    if (obj.type === 'stroke') {
      const pts = obj.points || [];
      if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(function (p) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      const pad = Math.max(2, (obj.width || 3) / 2);
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    if (obj.type === 'text') {
      const m = S.textMetrics(obj);
      return { x: obj.x - 4, y: obj.y - 4, w: m.width + 8, h: m.height + 8 };
    }
    const pad = Math.max(2, (obj.width || 3) / 2);
    return {
      x: Math.min(obj.x1, obj.x2) - pad,
      y: Math.min(obj.y1, obj.y2) - pad,
      w: Math.abs(obj.x2 - obj.x1) + pad * 2,
      h: Math.abs(obj.y2 - obj.y1) + pad * 2
    };
  };

  S.hitTest = function (obj, x, y, tol) {
    if (!obj) return false;
    tol = tol == null ? 5 : tol;
    if (obj.type === 'stroke') {
      const pts = obj.points || [];
      const limit = Math.max(4, (obj.width || 3) / 2 + tol);
      if (pts.length === 1) return Math.hypot(x - pts[0].x, y - pts[0].y) <= limit;
      for (let i = 1; i < pts.length; i++) {
        if (U.pointSegmentDistance(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= limit) return true;
      }
      return false;
    }
    if (obj.type === 'text') {
      const b = S.bounds(obj);
      return U.pointInRect(x, y, { x: b.x - tol, y: b.y - tol, w: b.w + tol * 2, h: b.h + tol * 2 });
    }
    if (obj.type === 'line' || obj.type === 'arrow') {
      return U.pointSegmentDistance(x, y, obj.x1, obj.y1, obj.x2, obj.y2) <= Math.max(5, (obj.width || 3) / 2 + tol);
    }
    const b = S.bounds(obj);
    if (!U.pointInRect(x, y, { x: b.x - tol, y: b.y - tol, w: b.w + tol * 2, h: b.h + tol * 2 })) return false;
    if (obj.fill || S.is3D(obj.type)) return true;
    const nearEdge =
      Math.abs(x - b.x) <= tol + 2 || Math.abs(x - (b.x + b.w)) <= tol + 2 ||
      Math.abs(y - b.y) <= tol + 2 || Math.abs(y - (b.y + b.h)) <= tol + 2;
    return nearEdge;
  };

  S.translate = function (obj, dx, dy) {
    if (!obj) return obj;
    if (obj.type === 'stroke') {
      (obj.points || []).forEach(function (p) { p.x += dx; p.y += dy; });
    } else if (obj.type === 'text') {
      obj.x += dx;
      obj.y += dy;
    } else {
      obj.x1 += dx;
      obj.y1 += dy;
      obj.x2 += dx;
      obj.y2 += dy;
    }
    return obj;
  };

  S.scale = function (obj, sx, sy, ox, oy) {
    if (!obj) return obj;
    const avg = Math.sqrt(Math.abs(sx * sy)) || 1;
    if (obj.type === 'stroke') {
      (obj.points || []).forEach(function (p) {
        p.x = ox + (p.x - ox) * sx;
        p.y = oy + (p.y - oy) * sy;
      });
    } else if (obj.type === 'text') {
      obj.x = ox + (obj.x - ox) * sx;
      obj.y = oy + (obj.y - oy) * sy;
      obj.size = U.clamp(obj.size * Math.max(0.3, Math.abs(sy)), 6, 320);
    } else {
      obj.x1 = ox + (obj.x1 - ox) * sx;
      obj.y1 = oy + (obj.y1 - oy) * sy;
      obj.x2 = ox + (obj.x2 - ox) * sx;
      obj.y2 = oy + (obj.y2 - oy) * sy;
    }
    obj.width = U.clamp((obj.width || 3) * avg, 0.5, 80);
    return obj;
  };

  S.sampleObject = function (type) {
    const is3d = S.is3D(type);
    return {
      id: 'sample',
      type: type,
      x1: is3d ? 9 : 6,
      y1: is3d ? 5 : 8,
      x2: is3d ? 55 : 58,
      y2: is3d ? 43 : 40,
      color: is3d ? '#6366f1' : '#64748b',
      width: 2,
      fill: false,
      size: 32
    };
  };

  IB.shapes = S;
})(window);
