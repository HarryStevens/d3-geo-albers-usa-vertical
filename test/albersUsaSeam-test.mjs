/* eslint-env mocha */

import assert from "assert";
import {geoStream} from "d3-geo";
import {geoAlbersUsaSeam} from "../src/index.js";
import {assertOnePixelSeamOverlap, assertProjectionEqual, assertSeamLayout, ringBounds} from "./asserts.mjs";

it("albersUsaSeam(point) and albersUsaSeam.invert(point) returns the expected result", () => {
  const projection = geoAlbersUsaSeam();
  assertProjectionEqual(projection, [-122.4194, 37.7749], [276.3, 916.3], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [604.7, 390.1], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.6752, 39.0473], [662.2, 945.6], 0.1); // Topeka, KS
  assertProjectionEqual(projection, [ -92.1735, 38.5767], [354.1, 464.8], 0.1); // Jefferson City, MO
  assertProjectionEqual(projection, [-118.2437, 34.0522], [319.1, 1000.0], 0.1); // Los Angeles, CA
  assertProjectionEqual(projection, [ -95.3698, 29.7604], [667.8, 1120.2], 0.1); // Houston, TX
  assertProjectionEqual(projection, [-149.9003, 61.2181], [376.7, 1147.0], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [496.5, 1150.0], 0.1); // Honolulu, HI
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null);
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaSeam(point) and albersUsaSeam.invert(point) returns the expected result when the projection is reversed", () => {
  const projection = geoAlbersUsaSeam().reverse(true);
  assertProjectionEqual(projection, [-122.4194, 37.7749], [276.3, 454.5], 0.1); // San Francisco, CA
  assertProjectionEqual(projection, [ -74.0059, 40.7128], [604.7, 892.7], 0.1); // New York, NY
  assertProjectionEqual(projection, [ -95.6752, 39.0473], [662.2, 483.8], 0.1); // Topeka, KS
  assertProjectionEqual(projection, [ -92.1735, 38.5767], [354.1, 967.4], 0.1); // Jefferson City, MO
  assertProjectionEqual(projection, [-118.2437, 34.0522], [319.1, 538.2], 0.1); // Los Angeles, CA
  assertProjectionEqual(projection, [ -95.3698, 29.7604], [667.8, 658.5], 0.1); // Houston, TX
  assertProjectionEqual(projection, [-149.9003, 61.2181], [376.7, 685.3], 0.1); // Anchorage, AK
  assertProjectionEqual(projection, [-157.8583, 21.3069], [496.5, 688.3], 0.1); // Honolulu, HI
  assert.strictEqual(projection([2.3522, 48.8566]), null); // Paris, France
  assert.strictEqual(projection.invert([0, 0]), null);
  assert.strictEqual(projection.invert([10, 10]), null);
  assert.strictEqual(projection.invert([1000, 1000]), null);
});

it("albersUsaSeam draws polygons along the state border", () => {
  assertSeamLayout(() => geoAlbersUsaSeam());
});

it("albersUsaSeam.seampad defaults to 0", () => {
  const projection = geoAlbersUsaSeam();
  assert.strictEqual(projection.seampad(), 0);
  assert.strictEqual(projection.seampad(1), projection);
  assert.strictEqual(projection.seampad(), 1);
  const seamLon = -96.4536;
  const beside = projection.seampad(0)([seamLon + 0.05, 44]);
  const further = projection([seamLon + 0.15, 44]);
  const pixelsPerDegree = Math.abs(further[0] - beside[0]) / 0.1;
  const bounds = ringBounds(projection, {
    type: "LineString",
    coordinates: [[seamLon - 0.5 / pixelsPerDegree, 44.2], [seamLon - 0.5 / pixelsPerDegree, 43.8]]
  });
  assert.strictEqual(bounds.length, 1);
  assert.ok(bounds[0][1] > 700);
});

it("albersUsaSeam draws a border one pixel across the seam", () => {
  assertOnePixelSeamOverlap(() => geoAlbersUsaSeam().seampad(1));
});

it("albersUsaSeam.invert returns the padded border on the top panel", () => {
  const projection = geoAlbersUsaSeam().seampad(1);
  const seamLon = -96.4536;
  const beside = projection([seamLon + 0.05, 44]);
  const further = projection([seamLon + 0.15, 44]);
  const pixelsPerDegree = Math.abs(further[0] - beside[0]) / 0.1;
  const lon = seamLon - 0.5 / pixelsPerDegree;
  const points = [];
  geoStream({type: "LineString", coordinates: [[lon, 44.2], [lon, 43.8]]}, projection.stream({
    point(x, y) { points.push([x, y]); },
    lineStart() {},
    lineEnd() {},
    polygonStart() {},
    polygonEnd() {},
    sphere() {}
  }));
  const top = points.filter(point => point[1] < 500);
  assert.ok(top.length, "expected the padded line on the top panel");
  const inverted = projection.invert(top[0]);
  assert.ok(inverted, "expected the padded pixel to invert");
  assert.ok(Math.abs(inverted[0] - lon) < 0.05);
  assert.ok(inverted[1] > 43.7 && inverted[1] < 44.3);
});

it("albersUsaSeam.seampad does not change how the projection fits", () => {
  const object = {
    type: "MultiPoint",
    coordinates: [[-74.0059, 40.7128], [-122.4194, 37.7749], [-95.3698, 29.7604]]
  };
  const plain = geoAlbersUsaSeam().fitSize([300, 800], object);
  const padded = geoAlbersUsaSeam().seampad(100).fitSize([300, 800], object);
  assert.strictEqual(padded.seampad(), 100);
  assert.strictEqual(plain.scale(), padded.scale());
  assert.deepStrictEqual(plain.translate(), padded.translate());
  assert.deepStrictEqual(plain([-74.0059, 40.7128]), padded([-74.0059, 40.7128]));
});

it("albersUsaSeam fits a set of points", () => {
  const projection = geoAlbersUsaSeam();
  projection.fitSize([300, 800], {
    type: "MultiPoint",
    coordinates: [[-74.0059, 40.7128], [-122.4194, 37.7749]]
  });
  const ny = projection([-74.0059, 40.7128]);
  const sf = projection([-122.4194, 37.7749]);
  for (const point of [ny, sf]) {
    assert.ok(point[0] >= -1 && point[0] <= 301, point);
    assert.ok(point[1] >= -1 && point[1] <= 801, point);
  }
  assert.ok(ny[1] < sf[1]);
});
