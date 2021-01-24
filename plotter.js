'use strict';

function toRad(deg) {
  return (Math.PI / 180) * deg;
}

function isNear(value, target, error) {
  return Math.abs(target - value) <= error;
}

function isInRange(value, from, to, error = 0) {
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  return value >= min - error && value <= max + error;
}

function line2line(A1, B1, C1, A2, B2, C2) {
  const det = A1 * B2 - A2 * B1;

  if (det == 0) return undefined;

  return new ImmutableVec2(
    (B2 * C1 - B1 * C2) / det,
    (A1 * C2 - A2 * C1) / det
  );
}

function segment2segment(a1, a2, b1, b2) {
  const e = 0.01;
  const A1 = a2[1] - a1[1];
  const B1 = a1[0] - a2[0];
  const C1 = A1 * a1[0] + B1 * a1[1];
  const A2 = b2[1] - b1[1];
  const B2 = b1[0] - b2[0];
  const C2 = A2 * b1[0] + B2 * b1[1];

  const intersectionPoint = line2line(A1, B1, C1, A2, B2, C2);

  if (!intersectionPoint) return undefined;

  const { x, y } = intersectionPoint;
  const isPointOnLine = isInRange(x, Math.min(a1[0], a2[0]), Math.max(a1[0], a2[0]), e) &&
    isInRange(x, Math.min(b1[0], b2[0]), Math.max(b1[0], b2[0]), e);

  if (isPointOnLine) return new ImmutableVec2(x, y);
}

// This is an optimized geometrical solution.
// All intermediate calculations and square roots removed where possible.
// Alternative is to solve quadratic equation of | Ro + Rd*t - So | = r
function ray2sphere(rayOrigin, rayDirection, sphereOrigin, sphereRadius) {
  const S = sphereOrigin.vsub(rayOrigin);
  const P = rayDirection.dot(S);
  const H = sphereRadius ** 2 - (S.dot(S) - P ** 2);

  if (H < 0) return undefined;

  const h = Math.sqrt(H);
  const t1 = P + h;

  // Both points are behind the ray origin
  if (t1 < 0) return undefined;

  const t2 = P - h;

  const min_t = Math.min(t1, t2);
  const max_t = Math.max(t1, t2);

  return (min_t >= 0) ? min_t : max_t;
}

class ImmutableVec2 extends Array {
  constructor(x, y) {
    super();
    this.set(x, y);
    Object.freeze(this);
  }

  set(x, y) {
    if (Array.isArray(x) || x instanceof ImmutableVec2) {
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
  }

  get x() {
    return this[0];
  }

  get y() {
    return this[1];
  }

  negate() {
    return new ImmutableVec2(-this[0], -this[1]);
  }

  distance() {
    return Math.sqrt(this[0] ** 2 + this[1] ** 2);
  }

  clone() {
    return new ImmutableVec2(this[0], this[1]);
  }

  vsub(vector) {
    return new ImmutableVec2(this[0] - vector[0], this[1] - vector[1]);
  }

  ssub(scalar) {
    return new ImmutableVec2(this[0] - scalar, this[1] - scalar);
  }

  vadd(vector) {
    return new ImmutableVec2(this[0] + vector[0], this[1] + vector[1]);
  }

  sadd(scalar) {
    return new ImmutableVec2(this[0] + scalar, this[1] + scalar);
  }

  sdiv(scalar) {
    return new ImmutableVec2(this[0] / scalar, this[1] / scalar);
  }

  vmul(vector) {
    return new ImmutableVec2(this[0] * vector[0], this[1] * vector[1]);
  }

  smul(scalar) {
    return new ImmutableVec2(this[0] * scalar, this[1] * scalar);
  }

  dot(vector) {
    return this[0] * vector[0] + this[1] * vector[1];
  }

  normalize(unit = 1) {
    const len = this.distance() / unit;
    return new ImmutableVec2(this[0] / len, this[1] / len);
  }

  angleX() {
    return Math.atan2(this[1], this[0]);
  }

  reflect(normal) {
    const dot = this[0] * normal[0] + this[1] * normal[1];
    return new ImmutableVec2(this[0] - 2 * dot * normal[0], this[1] - 2 * dot * normal[1]);
  }

  refract(normal, factor) {
    const incident = this.normalize();
    const dot = normal.dot(incident);
    const k = 1 - factor * factor * (1 - dot * dot);
    if (k < 0) return vec2(0);
    const nfactor = factor * dot + Math.sqrt(k);
    return new ImmutableVec2(
      factor * incident[0] - nfactor * normal[0],
      factor * incident[1] - nfactor * normal[1]);
  }

  rotate(angle) {
    const { x, y } = this;
    return new ImmutableVec2(
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle)
    );
  }

  polarToCartesian() {
    const { x, y } = this;
    return new ImmutableVec2(
      x * Math.cos(y),
      x * Math.sin(y)
    );
  }
}

// Shorthand
function vec2(x, y) {
  return new ImmutableVec2(x, y);
}

const SIN_45 = Math.sin(Math.PI / 4);

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
      this.canvasSize[0] / (this.domain[0][1] - this.domain[0][0]) * radius,
      startAngle,
      endAngle,
      true);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  sector(center, radius, startAngle = 0, endAngle = Math.PI * 2) {
    this.ctx.beginPath();
    this.ctx.arc(
      ...this.mapToCanvas(center),
      this.canvasSize[0] / (this.domain[0][1] - this.domain[0][0]) * radius,
      startAngle,
      endAngle,
      true);
    this.ctx.fill();
    this.ctx.closePath();
  }

  point(at, label) {
    const [x, y] = this.mapToCanvas(at);
    this.ctx.beginPath()
    this.ctx.arc(x, y, 3, 0, Math.PI * 2, true);
    this.ctx.closePath();
    this.ctx.fill();

    if (label) {
      this.ctx.fillText(label, x - 4, y + -7);
    }
  }

  set fill(style) {
    this.ctx.fillStyle = style;
  }

  set stroke(style) {
    this.ctx.strokeStyle = style;
  }

  segment(a, b, label, labelPos = 0.5) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.moveTo(a);
    this.lineTo(b);
    ctx.stroke();
    ctx.closePath();

    if (label) {
      const direction = a.vsub(b);
      const shift = direction
        .normalize()
        .rotate(Math.sign(Math.cos(direction.angleX())) * Math.PI / 2)
        .smul(0.025);
      this.text(label, b.vadd(direction.smul(labelPos)).vadd(shift));
    }
  }

  vector(origin, direction, label, labelPos = 0.5) {
    const ctx = this.ctx;
    const arrowSize = 15 / this.canvasSize[0] * Math.abs(this.domain[0][1] - this.domain[0][0]);
    const end = origin.vadd(direction);
    const angle = direction.angleX();

    ctx.fillStyle = ctx.strokeStyle;

    ctx.beginPath();
    this.moveTo(origin);
    this.lineTo(end);
    this.lineTo([
      end.x - Math.cos(angle + 0.2) * arrowSize,
      end.y - Math.sin(angle + 0.2) * arrowSize,
    ]);
    this.lineTo([
      end.x - Math.cos(angle - 0.2) * arrowSize,
      end.y - Math.sin(angle - 0.2) * arrowSize,
    ]);
    this.lineTo(end);
    ctx.stroke();
    ctx.fill();
    ctx.closePath();
    if (label) {
      const shift = direction
        .normalize()
        .rotate(Math.sign(Math.cos(angle)) * Math.PI / 2)
        .smul(0.05);
      this.text(label, origin.vadd(shift).vadd(direction.smul(labelPos)));
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

  graphLayout(axesSize, gridSize) {
    this.fill = 'ivory';
    this.clear();
    this.stroke = 'bisque';
    this.grid(gridSize);
    if (axesSize) {
      this.stroke = 'cadetblue';
      this.axes(axesSize);
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

  /**
   *
   * @param {object} options
   * @param {Function} options.fn
   * @param {string} options.color
   * @param {boolean} options.debugFrame
   * @param {boolean} options.frameColor
   * @param {Array<Array<number>} options.domain
   * @param {Array<Array<number>} rects
   * @param {number} level
   */
  sdfIsoline(options, rects = [], level = 0) {
    const domain = options.domain || this.domain;

    // Clearance
    const E = 1e-5;
    // Grid size, aka step
    const s = (domain[0][1] - domain[0][0]) / 2;
    const sPx = this.map(
      [0, this.domain[0][1] - this.domain[0][0]],
      [0, this.canvasSize[0]],
      s
    );

    const points = [];

    this.ctx.beginPath();

    for (let x = domain[0][0]; x < domain[0][1]; x += s) {
      for (let y = domain[1][0]; y < domain[1][1]; y += s) {
        const centerValue = options.fn(x + s/2, y + s/2);

        if (Math.abs(centerValue) > s * SIN_45) {
          continue;
        }

        rects.push([...this.mapToCanvas([x, y + s]), sPx, sPx]);

        if (sPx < 10) {
          const v0 = options.fn(x, y);
          const v1 = options.fn(x + s, y);
          const v2 = options.fn(x + s, y + s);
          const v3 = options.fn(x, y + s);

          if (Math.sign(v0) !== Math.sign(v1)) {
            points.push([x + s/2, y]);
          }

          if (Math.sign(v1) !== Math.sign(v2)) {
            points.push([x + s, y + s/2]);
          }

          if (Math.sign(v2) !== Math.sign(v3)) {
            points.push([x + s/2, y + s]);
          }

          if (Math.sign(v3) !== Math.sign(v0)) {
            points.push([x, y + s/2]);
          }

          if (points.length > 1) {
            if (sPx <= 10) {
              this.moveTo(points[0]);
              for (let i = 1; i < points.length; i += 1) this.lineTo(points[i]);
            }
          }

          points.length = 0;
        } else {
          for (let x1 = x; x1 < x + s; x1 += s) {
            for (let y1 = y; y1 < y + s; y1 += s) {
              this.sdfIsoline({
                ...options,
                domain: [
                  [x1, x1 + s],
                  [y1, y1 + s],
                ],
              }, rects, level + 1);
            }
          }
        }
      }
    }

    this.ctx.strokeStyle = options.color || 'green';
    this.ctx.stroke();
    this.ctx.closePath();

    if (options.debugFrame && level === 0) {
      this.ctx.beginPath();

      for (const rect of rects) {
        this.ctx.rect(...rect);
      }
      this.ctx.strokeStyle = options.frameColor || 'rgba(255, 127, 0, 0.25)';
      this.ctx.stroke();
      this.ctx.closePath();
    }
  }
}
