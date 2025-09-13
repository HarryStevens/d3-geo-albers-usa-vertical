/* eslint-env mocha */

import assert from "assert";
import {geoAlbersUsaVertical} from "../src/index.js";
import {assertProjectionEqual} from "./asserts.js";

it("albersUsa(point) and albersUsa.invert(point) returns the expected result", () => {
  const albersUsaVertical = geoAlbersUsaVertical();
  assertProjectionEqual(albersUsaVertical, [-122.4194, 37.7749], [107.4, 705.3], 0.1); // San Francisco, CA
  assertProjectionEqual(albersUsaVertical, [ -74.0059, 40.7128], [406.2, 176.5], 0.1); // New York, NY
  assertProjectionEqual(albersUsaVertical, [ -95.9928, 36.1540], [100.4, 298.0], 0.1); // Tulsa, OK
  assertProjectionEqual(albersUsaVertical, [-149.9003, 61.2181], [216.1, 934.9], 0.1); // Anchorage, AK
  assertProjectionEqual(albersUsaVertical, [-157.8583, 21.3069], [335.9, 937.8], 0.1); // Honolulu, HI
  assert.strictEqual(albersUsaVertical([2.3522, 48.8566]), null); // Paris, France
});

it("albersUsa(point) and albersUsa.invert(point) returns the expected result when the projection is reversed", () => {
  const albersUsaVertical = geoAlbersUsaVertical().reverse(true);
  assertProjectionEqual(albersUsaVertical, [-122.4194, 37.7749], [107.4, 214.1], 0.1); // San Francisco, CA
  assertProjectionEqual(albersUsaVertical, [ -74.0059, 40.7128], [406.2, 636.6], 0.1); // New York, NY
  assertProjectionEqual(albersUsaVertical, [ -95.9928, 36.1540], [100.4, 758.1], 0.1); // Tulsa, OK
  assertProjectionEqual(albersUsaVertical, [-149.9003, 61.2181], [216.1, 443.7], 0.1); // Anchorage, AK
  assertProjectionEqual(albersUsaVertical, [-157.8583, 21.3069], [335.9, 446.7], 0.1); // Honolulu, HI
  assert.strictEqual(albersUsaVertical([2.3522, 48.8566]), null); // Paris, France
});