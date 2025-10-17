/* eslint-env mocha */

import assert from "assert";
import { geoAlbersUsaPrVertical } from "../src/index.js";
import { assertProjectionEqual } from "./asserts.mjs";

it("albersUsaPrVertical(point) and albersUsaPrVertical.invert(point) returns the expected result", () => {
  const projection = geoAlbersUsaPrVertical();
  assertProjectionEqual(projection, [-122.4194, 37.7749], [107.4, 705.3], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [406.2, 176.5], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.9928, 36.1540], [100.4, 298.0], 0.1); // Tulsa, OK
  assertProjectionEqual(projection, [-149.9003, 61.2181], [216.1, 934.9], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [335.9, 937.8], 0.1); // Honolulu, HI
  assertProjectionEqual(projection, [ -66.0617, 18.3982], [453.2, 482.2], 0.1); // San Juan, PR
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
});

it("albersUsaPrVertical(point) and albersUsaPrVertical.invert(point) returns the expected result when the projection is reversed", () => {
  const projection = geoAlbersUsaPrVertical().reverse(true);
  assertProjectionEqual(projection, [-122.4194, 37.7749], [107.4, 214.1], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [406.2, 636.6], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.9928, 36.1540], [100.4, 758.1], 0.1); // Tulsa, OK
  assertProjectionEqual(projection, [-149.9003, 61.2181], [216.1, 443.7], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [335.9, 446.7], 0.1); // Honolulu, HI
  assertProjectionEqual(projection, [ -66.0617, 18.3982], [453.2, 942.3], 0.1); // San Juan, PR
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
});