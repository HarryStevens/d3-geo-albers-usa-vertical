/* eslint-env mocha */

import assert from "assert";
import { geoAlbersUsaVertical } from "../src/index.js";
import { splitX, splitY, eastYRange, westYRange } from "../src/constants.js";
import { assertLower48Layout, assertProjectionEqual } from "./asserts.mjs";

it("albersUsaVertical(point) and albersUsaVertical.invert(point) returns the expected result", () => {
  const projection = geoAlbersUsaVertical();
  assertProjectionEqual(projection, [-122.4194, 37.7749], [107.4, 705.3], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [406.2, 176.5], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.9928, 36.1540], [100.4, 298.0], 0.1); // Tulsa, OK
  assertProjectionEqual(projection, [-149.9003, 61.2181], [216.1, 934.9], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [335.9, 937.8], 0.1); // Honolulu, HI
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null); // used to come back a full panel away
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaVertical(point) and albersUsaVertical.invert(point) returns the expected result when the projection is reversed", () => {
  const projection = geoAlbersUsaVertical().reverse(true);
  assertProjectionEqual(projection, [-122.4194, 37.7749], [107.4, 214.1], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [406.2, 636.6], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.9928, 36.1540], [100.4, 758.1], 0.1); // Tulsa, OK
  assertProjectionEqual(projection, [-149.9003, 61.2181], [216.1, 443.7], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [335.9, 446.7], 0.1); // Honolulu, HI
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null);
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaVertical draws polygons in the correct panel", () => {
  assertLower48Layout(() => geoAlbersUsaVertical());
});

it("albersUsaVertical.seampad extends the meridian clip without changing the fit", () => {
  const projection = geoAlbersUsaVertical();
  assert.strictEqual(projection.seampad(), 0);
  const [tx, ty] = projection.translate();
  const scale = projection.scale();
  const bandX = splitX * scale;
  const yMid = ty + (eastYRange[0] + eastYRange[1]) / 2 * scale;
  const pixel = [tx - bandX - 0.5, yMid];
  assert.strictEqual(projection.invert(pixel), null);
  projection.seampad(1);
  const inverted = projection.invert(pixel);
  assert.ok(inverted, "expected a pixel in the pad to invert onto the top panel");
  assert.ok(inverted[1] > 20 && inverted[1] < 55);
  const object = {type: "MultiPoint", coordinates: [[-122.4194, 37.7749], [-74.0059, 40.7128]]};
  const plain = geoAlbersUsaVertical().fitSize([300, 800], object);
  const padded = geoAlbersUsaVertical().seampad(100).fitSize([300, 800], object);
  assert.strictEqual(padded.seampad(), 100);
  assert.strictEqual(plain.scale(), padded.scale());
  assert.deepStrictEqual(plain.translate(), padded.translate());
});

it("albersUsaVertical.invert prefers the panel on top where the panels overlap", () => {
  const projection = geoAlbersUsaVertical().reverse(true);
  const [tx, ty] = projection.translate();
  const scale = projection.scale();
  const westBottom = ty + westYRange[1] * scale;
  const eastTop = ty + splitY(true) * scale + eastYRange[0] * scale;
  // Right of the Hawaii inset, where the two lower-48 clip rectangles overlap.
  const pixel = [tx - 50, (westBottom + eastTop) / 2];
  const inverted = projection.invert(pixel);
  assert.ok(inverted[0] < -90, `expected the western panel on top, got ${inverted}`);
});