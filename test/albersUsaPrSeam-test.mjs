/* eslint-env mocha */

import assert from "assert";
import {geoAlbersUsaPrSeam} from "../src/index.js";
import {assertMatchesProjection, assertOnePixelSeamOverlap, assertProjectionEqual, assertSeamLayout, polygon, ringBounds} from "./asserts.mjs";

it("albersUsaPrSeam(point) and albersUsaPrSeam.invert(point) returns the expected result", () => {
  const projection = geoAlbersUsaPrSeam();
  assertProjectionEqual(projection, [-122.4194, 37.7749], [276.3, 916.3], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [604.7, 390.1], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.6752, 39.0473], [662.2, 945.6], 0.1); // Topeka, KS
  assertProjectionEqual(projection, [ -92.1735, 38.5767], [354.1, 464.8], 0.1); // Jefferson City, MO
  assertProjectionEqual(projection, [-118.2437, 34.0522], [319.1, 1000.0], 0.1); // Los Angeles, CA
  assertProjectionEqual(projection, [ -95.3698, 29.7604], [667.8, 1120.2], 0.1); // Houston, TX
  assertProjectionEqual(projection, [-149.9003, 61.2181], [376.7, 1147.0], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [496.5, 1150.0], 0.1); // Honolulu, HI
  assertProjectionEqual(projection, [ -80.1918, 25.7617], [566.0, 683.8], 0.1); // Miami, FL
  assertProjectionEqual(projection, [ -66.0617, 18.3982], [639.1, 682.9], 0.1); // San Juan, PR
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null);
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaPrSeam(point) and albersUsaPrSeam.invert(point) returns the expected result when the projection is reversed", () => {
  const projection = geoAlbersUsaPrSeam().reverse(true);
  assertProjectionEqual(projection, [-122.4194, 37.7749], [276.3, 454.5], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [604.7, 892.7], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.6752, 39.0473], [662.2, 483.8], 0.1); // Topeka, KS
  assertProjectionEqual(projection, [ -92.1735, 38.5767], [354.1, 967.4], 0.1); // Jefferson City, MO
  assertProjectionEqual(projection, [-118.2437, 34.0522], [319.1, 538.2], 0.1); // Los Angeles, CA
  assertProjectionEqual(projection, [ -95.3698, 29.7604], [667.8, 658.5], 0.1); // Houston, TX
  assertProjectionEqual(projection, [-149.9003, 61.2181], [376.7, 685.3], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [496.5, 688.3], 0.1); // Honolulu, HI
  assertProjectionEqual(projection, [ -80.1918, 25.7617], [566.0, 1186.4], 0.1); // Miami, FL
  assertProjectionEqual(projection, [ -66.0617, 18.3982], [639.1, 1185.6], 0.1); // San Juan, PR
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null);
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaPrSeam draws a border one pixel across the seam", () => {
  assertOnePixelSeamOverlap(() => geoAlbersUsaPrSeam());
});

it("albersUsaPrSeam draws polygons along the state border", () => {
  assertSeamLayout(() => geoAlbersUsaPrSeam());

  const rico = [[-67.2, 17.9], [-67.2, 18.6], [-65.6, 18.6], [-65.6, 17.9]];
  const projection = geoAlbersUsaPrSeam();
  const bounds = ringBounds(projection, polygon(rico));
  const west = ringBounds(projection, polygon([[-110, 38], [-110, 40], [-105, 40], [-105, 38]]));
  assert.strictEqual(bounds.length, 1);
  assertMatchesProjection(projection, rico, bounds[0]);
  assert.ok(bounds[0][3] < west[0][1], "Puerto Rico should sit with the eastern states");

  const reversed = geoAlbersUsaPrSeam().reverse(true);
  const reversedBounds = ringBounds(reversed, polygon(rico));
  const reversedWest = ringBounds(reversed, polygon([[-110, 38], [-110, 40], [-105, 40], [-105, 38]]));
  assert.strictEqual(reversedBounds.length, 1);
  assertMatchesProjection(reversed, rico, reversedBounds[0]);
  assert.ok(reversedBounds[0][1] > reversedWest[0][3], "reversed Puerto Rico should sit with the eastern states");
});
