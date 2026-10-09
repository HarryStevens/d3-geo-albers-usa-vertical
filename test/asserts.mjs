/* eslint-env mocha */

import assert from "assert";
import {geoPath, geoStream} from "d3-geo";

export function assertProjectionEqual(projection, location, point, delta) {
  assert(planarEqual(projection(location), point, delta || 1e-6)
      && sphericalEqual(projection.invert(point), location, delta || 1e-3), 
    `${[projection.invert(point), projection(location)]} should be projected equivalents; expected: ${[location, point]}`);
}

function planarEqual(actual, expected, delta) {
  return Array.isArray(actual)
      && actual.length === 2
      && inDelta(actual[0], expected[0], delta)
      && inDelta(actual[1], expected[1], delta);
}

function sphericalEqual(actual, expected, delta) {
  return Array.isArray(actual)
      && actual.length === 2
      && longitudeEqual(actual[0], expected[0], delta)
      && inDelta(actual[1], expected[1], delta);
}

function longitudeEqual(actual, expected, delta) {
  actual = Math.abs(actual - expected) % 360;
  return actual <= delta || actual >= 360 - delta;
}

function inDelta(actual, expected, delta) {
  return Math.abs(actual - expected) <= delta;
}

export function polygon(ring) {
  return {type: "Polygon", coordinates: [[...ring, ring[0]]]};
}

// Pixel bounds of each ring the projection actually emits.
export function ringBounds(projection, geometry) {
  const bounds = [];
  let ring = null;
  geoStream(geometry, projection.stream({
    point(x, y) { ring.push([x, y]); },
    lineStart() { ring = []; },
    lineEnd() {
      if (!ring || !ring.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < ring.length; ++i) {
        const x = ring[i][0], y = ring[i][1];
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
      bounds.push([x0, y0, x1, y1]);
    },
    polygonStart() {},
    polygonEnd() {},
    sphere() {}
  }));
  return bounds;
}

function assertSmall(bounds) {
  assert.ok(bounds[2] - bounds[0] < 250 && bounds[3] - bounds[1] < 250, `ring covers a whole panel: ${bounds}`);
}

export function assertInPanel(bounds, side) {
  assert.strictEqual(bounds.length, 1, `expected one ring, got ${bounds.length}`);
  assertSmall(bounds[0]);
  if (side === "top") assert.ok(bounds[0][3] < 400, `expected the top panel, got y ${bounds[0][1]}–${bounds[0][3]}`);
  else assert.ok(bounds[0][1] > 600, `expected the bottom panel, got y ${bounds[0][1]}–${bounds[0][3]}`);
}

export function assertSplitAcrossPanels(bounds) {
  assert.strictEqual(bounds.length, 2, `expected a piece in each panel, got ${bounds.length}`);
  for (let i = 0; i < bounds.length; ++i) assertSmall(bounds[i]);
  const top = bounds.filter(b => b[3] < 400);
  const bottom = bounds.filter(b => b[1] > 600);
  assert.strictEqual(top.length, 1, `expected one piece in the top panel: ${JSON.stringify(bounds)}`);
  assert.strictEqual(bottom.length, 1, `expected one piece in the bottom panel: ${JSON.stringify(bounds)}`);
}

// The drawn ring should match the projected corners, not the clip rectangle.
export function assertMatchesProjection(projection, ring, bounds) {
  const projected = ring.map(d => projection(d));
  assert.ok(projected.every(p => p), "a corner of the polygon was not projected");
  const xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
  const expected = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  for (let i = 0; i < 4; ++i) {
    assert.ok(Math.abs(bounds[i] - expected[i]) < 3, `drawn ${bounds} should match projected ${expected}`);
  }
}

export function assertLower48Layout(makeProjection) {
  const east = [[-90, 38], [-90, 40], [-88, 40], [-88, 38]];
  const west = [[-110, 38], [-110, 40], [-105, 40], [-105, 38]];
  const across = [[-100, 38], [-100, 40], [-90, 40], [-90, 38]];
  const counterclockwise = [[-90, 38], [-88, 38], [-88, 40], [-90, 40]];
  const hole = {
    type: "Polygon",
    coordinates: [
      [[-90, 35], [-90, 42], [-80, 42], [-80, 35], [-90, 35]],
      [[-88, 37], [-82, 37], [-82, 40], [-88, 40], [-88, 37]]
    ]
  };

  const projection = makeProjection();
  const eastBounds = ringBounds(projection, polygon(east));
  assertInPanel(eastBounds, "top");
  assertMatchesProjection(projection, east, eastBounds[0]);
  assertInPanel(ringBounds(projection, polygon(counterclockwise)), "top");
  assertMatchesProjection(projection, east, ringBounds(projection, polygon(counterclockwise))[0]);
  assertInPanel(ringBounds(projection, polygon(west)), "bottom");
  assertSplitAcrossPanels(ringBounds(projection, polygon(across)));

  const holeBounds = ringBounds(projection, hole);
  assert.strictEqual(holeBounds.length, 2);
  assertInPanel([holeBounds[0]], "top");
  assertInPanel([holeBounds[1]], "top");

  const reversed = makeProjection().reverse(true);
  assertInPanel(ringBounds(reversed, polygon(east)), "bottom");
  assertInPanel(ringBounds(reversed, polygon(west)), "top");
  assertSplitAcrossPanels(ringBounds(reversed, polygon(across)));
  const paris = polygon([[2, 48], [3, 48], [3, 49], [2, 49]]);
  assert.strictEqual(geoPath(projection)(paris), null);
  assert.strictEqual(geoPath(reversed)(paris), null);
}