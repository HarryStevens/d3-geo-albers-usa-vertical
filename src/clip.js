import polygonClipping from "polygon-clipping";
import {covers} from "./geo.js";

const intersection = polygonClipping.intersection;

// Planar clipping in longitude and latitude. The lower 48 does not cross the
// antimeridian, and the seam is a dense polyline, so a straight edge in
// degrees is the cut. A spherical preclip would run after geoAlbers rotates
// by 96° and would fill a panel for a small counterclockwise ring.

export function contains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const dx = xj - xi, dy = yj - yi;
    const l2 = dx * dx + dy * dy;
    if (l2 > 0) {
      let t = ((x - xi) * dx + (y - yi) * dy) / l2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = xi + t * dx, py = yi + t * dy;
      if ((px - x) * (px - x) + (py - y) * (py - y) < 1e-12) return true;
    }
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function clipLine(points, ring) {
  const lines = [];
  let line = null;
  for (let i = 0; i < points.length - 1; ++i) {
    const parts = clipSegment(points[i], points[i + 1], ring);
    for (let j = 0; j < parts.length; ++j) {
      const [start, end] = parts[j];
      if (line && near(line[line.length - 1], start)) line.push(end);
      else {
        if (line && line.length > 1) lines.push(line);
        line = [start, end];
      }
    }
  }
  if (line && line.length > 1) lines.push(line);
  return lines;
}

export function clipPolygon(rings, ring) {
  if (!rings.length || rings[0].length < 3) return [];
  return intersection([rings.map(close)], [[close(ring)]]);
}

// panels are {stream, ring, bounds}. insets are {stream, region}, where region
// is a geographicBounds result. Geometry that stays off the shared border is
// forwarded unchanged; geometry that can cross it is cut.
export function seamDispatch(panels, insets) {
  const seam = pad(sharedBounds(panels[0].ring, panels[1].ring), 0.02);
  const xs = [];
  const ys = [];
  const ringStarts = [];
  const ringEnds = [];
  let npts = 0;
  let nrings = 0;
  let inPolygon = false;
  let buffering = false;
  let ringAt = 0;

  function record(x, y) {
    xs[npts] = x;
    ys[npts] = y;
    ++npts;
  }

  function bounds(start, end) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = start; i < end; ++i) {
      const x = xs[i], y = ys[i];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }

  function copy(start, end) {
    const line = new Array(end - start);
    for (let i = start; i < end; ++i) line[i - start] = [xs[i], ys[i]];
    return line;
  }

  function replayLine(stream, line) {
    stream.lineStart();
    for (let i = 0; i < line.length; ++i) stream.point(line[i][0], line[i][1]);
    stream.lineEnd();
  }

  function replayPolygon(stream, polygon) {
    stream.polygonStart();
    for (let i = 0; i < polygon.length; ++i) replayLine(stream, polygon[i]);
    stream.polygonEnd();
  }

  function sendLine(line, box) {
    for (let i = 0; i < insets.length; ++i) {
      if (hits(insets[i].region, box)) replayLine(insets[i].stream, line);
    }
    for (let i = 0; i < panels.length; ++i) {
      const panel = panels[i];
      if (!overlaps(box, panel.bounds)) continue;
      if (clearOfSeam(box, panel.bounds, seam)) replayLine(panel.stream, line);
      else {
        const parts = clipLine(line, panel.ring);
        for (let j = 0; j < parts.length; ++j) replayLine(panel.stream, parts[j]);
      }
    }
  }

  function sendPolygon(polygon, box) {
    // Insets replay the original rings. Clip the panels after that, because
    // the polygon clipper may modify the coordinates it is given.
    for (let i = 0; i < insets.length; ++i) {
      if (hits(insets[i].region, box)) replayPolygon(insets[i].stream, polygon);
    }
    for (let i = 0; i < panels.length; ++i) {
      const panel = panels[i];
      if (!overlaps(box, panel.bounds)) continue;
      if (clearOfSeam(box, panel.bounds, seam)) replayPolygon(panel.stream, polygon);
      else emitClipped(panel.stream, clipPolygon(polygon, panel.ring));
    }
  }

  return {
    point(x, y) {
      if (buffering) record(x, y);
      else {
        for (let i = 0; i < panels.length; ++i) {
          if (contains(panels[i].ring, x, y)) {
            panels[i].stream.point(x, y);
            return;
          }
        }
        for (let i = 0; i < insets.length; ++i) {
          if (covers(insets[i].region, x, y)) insets[i].stream.point(x, y);
        }
      }
    },
    sphere() {
      for (let i = 0; i < panels.length; ++i) panels[i].stream.sphere();
      for (let i = 0; i < insets.length; ++i) insets[i].stream.sphere();
    },
    lineStart() {
      buffering = true;
      ringAt = npts;
      if (!inPolygon) npts = ringAt = 0;
    },
    lineEnd() {
      buffering = false;
      if (inPolygon) {
        ringStarts[nrings] = ringAt;
        ringEnds[nrings] = npts;
        ++nrings;
      } else if (npts) {
        const line = copy(0, npts);
        sendLine(line, bounds(0, npts));
      }
    },
    polygonStart() {
      inPolygon = true;
      nrings = 0;
      npts = 0;
    },
    polygonEnd() {
      if (npts) {
        const polygon = new Array(nrings);
        for (let i = 0; i < nrings; ++i) polygon[i] = copy(ringStarts[i], ringEnds[i]);
        sendPolygon(polygon, bounds(0, npts));
      }
      inPolygon = false;
    }
  };
}

function clipSegment(a, b, ring) {
  const hits = [];
  for (let i = 0; i < ring.length; ++i) {
    const hit = segmentHit(a, b, ring[i], ring[(i + 1) % ring.length]);
    if (hit && hit.t > 1e-9 && hit.t < 1 - 1e-9) hits.push(hit);
  }
  hits.sort((p, q) => p.t - q.t);
  const marks = [{t: 0, p: a}];
  for (let i = 0; i < hits.length; ++i) {
    if (hits[i].t - marks[marks.length - 1].t > 1e-9) marks.push(hits[i]);
  }
  if (1 - marks[marks.length - 1].t > 1e-9) marks.push({t: 1, p: b});
  const parts = [];
  for (let i = 0; i < marks.length - 1; ++i) {
    const t = (marks[i].t + marks[i + 1].t) / 2;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    if (contains(ring, x, y)) parts.push([marks[i].p, marks[i + 1].p]);
  }
  return parts;
}

function segmentHit(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (den > -1e-12 && den < 1e-12) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {t, p: [a[0] + t * rx, a[1] + t * ry]};
}

function emitClipped(stream, multi) {
  for (let i = 0; i < multi.length; ++i) {
    // Rounding the shared border leaves slivers on the wrong side. The largest
    // of those is about 1e-5 square degrees; the smallest real island is about
    // 4e-4. Drop anything in between.
    if (Math.abs(ringArea(multi[i][0])) < 1e-4) continue;
    const rings = [multi[i][0]];
    for (let j = 1; j < multi[i].length; ++j) {
      if (Math.abs(ringArea(multi[i][j])) >= 1e-8) rings.push(multi[i][j]);
    }
    stream.polygonStart();
    for (let j = 0; j < rings.length; ++j) {
      stream.lineStart();
      for (let k = 0; k < rings[j].length; ++k) stream.point(rings[j][k][0], rings[j][k][1]);
      stream.lineEnd();
    }
    stream.polygonEnd();
  }
}

function sharedBounds(a, b) {
  const seen = new Set(a.map(p => p[0] + " " + p[1]));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < b.length; ++i) {
    if (!seen.has(b[i][0] + " " + b[i][1])) continue;
    if (b[i][0] < x0) x0 = b[i][0];
    if (b[i][1] < y0) y0 = b[i][1];
    if (b[i][0] > x1) x1 = b[i][0];
    if (b[i][1] > y1) y1 = b[i][1];
  }
  return [x0, y0, x1, y1];
}

function pad(bounds, amount) {
  return [bounds[0] - amount, bounds[1] - amount, bounds[2] + amount, bounds[3] + amount];
}

function overlaps(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function clearOfSeam(box, panel, seam) {
  return box[0] > panel[0] && box[2] < panel[2] && box[1] > panel[1] && box[3] < panel[3] && !overlaps(box, seam);
}

function hits(region, box) {
  if (!region || box[3] < region.lat0 || box[1] > region.lat1) return false;
  if (region.anyLon) return true;
  if (!region.wrap) return box[2] >= region.lon0 && box[0] <= region.lon1;
  return box[2] >= region.lon0 || box[0] <= region.lon1;
}

function close(ring) {
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return ring.concat([first]);
}

function near(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}
