'use strict';

class Vec2 extends Array {
  constructor(x, y) {
    super();
    this.set(x, y);
  }

  set(x, y) {
    if (Array.isArray(x) || x instanceof Vec2) {
      this[0] = x[0];
      this[1] = x[1];
    } else if (typeof x === 'number' && typeof y !== 'number') {
      this[0] = x;
      this[1] = x;
    } else if (typeof x === 'number' && typeof y === 'number') {
      this[0] = x;
      this[1] = y;
    } else {
      throw new Error('At least one parameter is required to set vector');
    }

    return this;
  }

  get x() {
    return this[0];
  }

  get y() {
    return this[1];
  }

  negate() {
    this[0] = -this[0];
    this[1] = -this[1];
    return this;
  }

  distance() {
    const x = this[0];
    const y = this[1];
    return Math.sqrt(x * x + y * y);
  }

  clone() {
    return new Vec2(this[0], this[1]);
  }

  vsub(vector) {
    this[0] -= vector[0];
    this[1] -= vector[1];
    return this;
  }

  ssub(scalar) {
    this[0] -= scalar;
    this[1] -= scalar;
    return this;
  }

  vadd(vector) {
    this[0] += vector[0];
    this[1] += vector[1];
    return this;
  }

  sadd(scalar) {
    this[0] += scalar;
    this[1] += scalar;
    return this;
  }

  sdiv(scalar) {
    this[0] /= scalar;
    this[1] /= scalar;
    return this;
  }

  vmul(vector) {
    this[0] *= vector[0];
    this[1] *= vector[1];
    return this;
  }

  smul(scalar) {
    this[0] *= scalar;
    this[1] *= scalar;
    return this;
  }

  dot(vector) {
    return this[0] * vector[0] + this[1] * vector[1];
  }

  normalize(unit = 1) {
    const len = this.distance() / unit;
    this[0] /= len;
    this[1] /= len;
    return this;
  }

  angleX() {
    const len = this.distance();
    return this[1] < 0
      ? Math.PI + (Math.PI - Math.acos(this[0] / len))
      : Math.acos(this[0] / len);
  }

  reflect(normal) {
    const dot = this[0] * normal[0] + this[1] * normal[1];
    return new Vec2(this[0] - 2 * dot * normal[0], this[1] - 2 * dot * normal[1]);
  }

  refract(normal, factor) {
    const incident = this.clone().normalize();
    const dot = normal.dot(incident);
    const k = 1 - factor * factor * (1 - dot * dot);
    if (k < 0) return vec2(0);
    const nfactor = factor * dot + Math.sqrt(k);
    return vec2(
      factor * incident[0] - nfactor * normal[0],
      factor * incident[1] - nfactor * normal[1]);
  }

  rotate(angle) {
    const x = this[0];
    const y = this[1];
    this[0] = x * Math.cos(angle) - y * Math.sin(angle);
    this[1] = x * Math.sin(angle) + y * Math.cos(angle);
    return this;
  }

  static intersect(a1, a2, b1, b2) {
    const e = 0.01;
    const A1 = a2[1] - a1[1];
    const B1 = a1[0] - a2[0];
    const C1 = A1 * a1[0] + B1 * a1[1];
    const A2 = b2[1] - b1[1];
    const B2 = b1[0] - b2[0];
    const C2 = A2 * b1[0] + B2 * b1[1];
    const det = A1 * B2 - A2 * B1;
    if (det == 0) return;
    const x = (B2 * C1 - B1 * C2) / det;
    const y = (A1 * C2 - A2 * C1) / det;
    const isPointOnLine = x + e >= Math.min(a1[0], a2[0]) &&
      x - e <= Math.max(a1[0], a2[0]) &&
      x + e >= Math.min(b1[0], b2[0]) &&
      x - e <= Math.max(b1[0], b2[0]);
    if (isPointOnLine) return new Vec2(x, y);
  }
}

// Shorthand
function vec2(x, y) {
  return new Vec2(x, y);
}

class Plotter {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvasSize = [canvas.offsetWidth, canvas.offsetHeight];
    this.ctx = canvas.getContext('2d');
    this.ctx.translate(0.5, 0.5);
    this.viewport([-1, -1], [2, 2]);
  }

  viewport(origin, size) {
    this.domain = [
      [origin[0], origin[0] + size[0]],
      [origin[1], origin[1] + size[1]],
    ];
  }

  map(domain, range, value) {
    const domainSize = domain[1] - domain[0];
    const rangeSize = range[1] - range[0];
    return range[0] + rangeSize * (value - domain[0]) / domainSize;
  }

  // This section probably should be replaced with use of transform matrices
  // I dont use built-in canvas transforms since they make work with text harder
  mapToViewport(offset) {
    return vec2(
      this.map([0, this.canvasSize[0]], this.domain[0], offset[0]),
      -this.map([0, this.canvasSize[1]], this.domain[1], offset[1]));
  }

  mapToCanvas(point) {
    return vec2(
      this.map(this.domain[0], [0, this.canvasSize[0]], point[0]),
      this.map(this.domain[1], [0, this.canvasSize[1]], -point[1]));
  }

  moveTo(point) {
    this.ctx.moveTo(...this.mapToCanvas(point));
  }

  lineTo(point) {
    this.ctx.lineTo(...this.mapToCanvas(point));
  }

  text(string, point) {
    const oldFill = this.ctx.fillStyle;
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.fillText(string, ...this.mapToCanvas(point));
    this.ctx.fillStyle = oldFill;
  }

  arc(center, radius, startAngle = 0, endAngle = Math.PI * 2) {
    this.ctx.beginPath();
    this.ctx.arc(
      ...this.mapToCanvas(center),
      // FIXME: Probably I should switch to transform matrices...
      this.canvasSize[0] / (this.domain[0][1] - this.domain[0][0]) * radius,
      startAngle,
      endAngle,
      true);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  set fill(style) {
    this.ctx.fillStyle = style;
  }

  set stroke(style) {
    this.ctx.strokeStyle = style;
  }

  segment(a, b) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.moveTo(a);
    this.lineTo(b);
    ctx.stroke();
    ctx.closePath();
  }

  vector(origin, direction, label, labelPos = 0.5) {
    const ctx = this.ctx;
    const arrowSize = 0.05;
    const end = new Vec2(origin);
    end.vadd(direction);
    const angle = direction.angleX();

    ctx.beginPath();
    this.moveTo(origin);
    this.lineTo(end);
    this.lineTo([
      end.x - Math.cos(angle + 0.3) * arrowSize,
      end.y - Math.sin(angle + 0.3) * arrowSize,
    ]);
    this.lineTo([
      end.x - Math.cos(angle - 0.3) * arrowSize,
      end.y - Math.sin(angle - 0.3) * arrowSize,
    ]);
    this.lineTo(end);
    ctx.stroke();
    ctx.closePath();
    if (label) {
      const shift = direction.clone()
        .normalize()
        .rotate(Math.sign(Math.cos(angle)) * Math.PI / 2)
        .smul(0.05);
      this.text(label, origin.clone().vadd(shift).vadd(direction.clone().smul(labelPos)));
    }
  }

  clear() {
    this.ctx.fillRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
  }

  grid(step = 0.2) {
    const [dxs, dxe] = this.domain[0];
    const [dys, dye] = this.domain[1];
    for (let x = dxs; x < dxe; x += step) this.segment([x, dys], [x, dye]);
    for (let y = dys; y < dye; y += step) this.segment([dxs, y], [dxe, y]);
  }

  axes(size) {
    this.vector(vec2(-size, 0), vec2(size * 2, 0));
    this.vector(vec2(0, -size), vec2(0, size * 2));
  }

  graphLayout(axesSize) {
    plotter.fill = 'ivory';
    plotter.clear();
    plotter.stroke = 'bisque';
    plotter.grid();
    if (axesSize) {
      plotter.stroke = 'blue';
      plotter.axes(axesSize);
    }
  }

  plot(fn, from, to, step) {
    this.ctx.beginPath();
    this.moveTo([from, fn(from)]);
    for (let x = from + step; x <= to; x += step) {
      this.lineTo([x, fn(x)]);
    }
    this.ctx.stroke();
    this.ctx.closePath();
  }

  plotBezier(fn, from, to, step) {
    this.ctx.beginPath();
    this.moveTo([from, fn(from)]);
    for (let x = from + step; x <= to; x += step) {
      const y = fn(x);
      const control = vec2(x + x + step, y + fn(x + step)).sdiv(2);
      this.ctx.quadraticCurveTo(...this.mapToCanvas([x, y]), ...this.mapToCanvas(control));
    }
    this.ctx.stroke();
    this.ctx.closePath();
  }
}