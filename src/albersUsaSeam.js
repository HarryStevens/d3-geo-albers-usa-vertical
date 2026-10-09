import {geoAlbers, geoConicEqualArea} from "d3-geo";
import {eastExtent, eastRing, westExtent, westRing} from "./seam.js";
import {epsilon} from "./constants.js";
import {contains, seamDispatch} from "./clip.js";
import {covers, fitExtent, fitHeight, fitSize, fitWidth, geographicBounds} from "./geo.js";

// The lower 48 does not cross the antimeridian. The default clip would treat a
// small counterclockwise ring as the outside of the world and fill the panel.
const passThrough = stream => stream;

// The panels meet. Reversed, the eastern states sit below the western states,
// and a gap of one fiftieth of the scale keeps them apart.
const gap = 0;
const reversedGap = 0.02;

// Same scales as geoAlbersUsaVertical: Alaska at 0.35×, Hawaii at full scale.
// Clip-rectangle sizes and translate offsets match that projection, in units
// of scale. Hawaii sits against Alaska's right edge.
const alaskaScale = 0.35;
const margin = 0.01;

const alaskaSize = [0.187, 0.113];
const alaskaOffset = [0.098, 0.077];
const hawaiiSize = [0.093, 0.061];
const hawaiiShift = [alaskaSize[0], 0.045];
const hawaiiOffset = [0.006, 0.042];
const puertoRicoSize = [0.054, 0.030];
const puertoRicoOffset = [0.030, 0.020];

const eastBounds = ringBox(eastRing);
const westBounds = ringBox(westRing);

export default function geoAlbersUsaSeam() {
  return createAlbersUsaSeam(false);
}

export function createAlbersUsaSeam(hasPuertoRico) {
  let cache,
      cacheStream,
      lower48E = geoAlbers().preclip(passThrough),
      lower48W = geoAlbers().preclip(passThrough),
      lower48EPoint,
      lower48WPoint,
      alaska = geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]),
      alaskaPoint,
      hawaii = geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]),
      hawaiiPoint,
      puertoRico = hasPuertoRico ? geoConicEqualArea().rotate([66, 0]).center([0, 18]).parallels([8, 18]) : null,
      puertoRicoPoint,
      point,
      pointStream = {point: function(x, y) { point = [x, y]; }},
      alaskaBounds,
      hawaiiBounds,
      puertoRicoBounds,
      eastHit,
      westHit,
      clips;

  let k = 1070, x = 480, y = 250, reverse = false;

  function albersUsaSeam(coordinates) {
    const lon = coordinates[0], lat = coordinates[1];
    if (contains(eastRing, lon, lat)) {
      point = null;
      lower48EPoint.point(lon, lat);
      if (point) return point;
    } else if (contains(westRing, lon, lat)) {
      point = null;
      lower48WPoint.point(lon, lat);
      if (point) return point;
    }
    if (alaskaBounds && covers(alaskaBounds, lon, lat)) {
      point = null;
      alaskaPoint.point(lon, lat);
      if (point) return point;
    }
    if (hawaiiBounds && covers(hawaiiBounds, lon, lat)) {
      point = null;
      hawaiiPoint.point(lon, lat);
      if (point) return point;
    }
    if (puertoRico && covers(puertoRicoBounds, lon, lat)) {
      point = null;
      puertoRicoPoint.point(lon, lat);
      if (point) return point;
    }
    return null;
  }

  albersUsaSeam.invert = function(coordinates) {
    const px = coordinates[0], py = coordinates[1];
    for (let i = 0; i < clips.length; ++i) {
      const extent = clips[i][0];
      if (px >= extent[0][0] && px <= extent[1][0] && py >= extent[0][1] && py <= extent[1][1]) {
        return clips[i][1].invert(coordinates);
      }
    }
    if (inHit(eastHit, px, py)) {
      const ll = lower48E.invert(coordinates);
      if (ll && contains(eastRing, ll[0], ll[1])) return ll;
    }
    if (inHit(westHit, px, py)) {
      const ll = lower48W.invert(coordinates);
      if (ll && contains(westRing, ll[0], ll[1])) return ll;
    }
    return null;
  };

  albersUsaSeam.stream = function(stream) {
    if (cache && cacheStream === stream) return cache;
    const insets = [
      {stream: alaska.stream(stream), region: alaskaBounds},
      {stream: hawaii.stream(stream), region: hawaiiBounds}
    ];
    if (puertoRico) insets.push({stream: puertoRico.stream(stream), region: puertoRicoBounds});
    return cache = seamDispatch([
      {stream: lower48E.stream(cacheStream = stream), ring: eastRing, bounds: eastBounds},
      {stream: lower48W.stream(stream), ring: westRing, bounds: westBounds}
    ], insets);
  };

  albersUsaSeam.precision = function(_) {
    if (!arguments.length) return lower48E.precision();
    lower48E.precision(_), lower48W.precision(_), alaska.precision(_), hawaii.precision(_);
    if (puertoRico) puertoRico.precision(_);
    return reset();
  };

  albersUsaSeam.scale = function(_) {
    if (!arguments.length) return k;
    k = +_;
    return albersUsaSeam.translate([x, y]);
  };

  albersUsaSeam.reverse = function(_) {
    if (!arguments.length) return reverse;
    reverse = !!_;
    return albersUsaSeam.translate([x, y]);
  };

  albersUsaSeam.translate = function(_) {
    if (!arguments.length) return [x, y];
    x = +_[0];
    y = +_[1];

    lower48E.scale(k);
    lower48W.scale(k);
    alaska.scale(k * alaskaScale);
    hawaii.scale(k);
    if (puertoRico) puertoRico.scale(k);

    lower48E.translate([0, 0]);
    const eastBox = pixelBox(lower48E, eastExtent);
    const westBox = pixelBox(lower48E, westExtent);
    const eastH = eastBox[3] - eastBox[1];
    const westH = westBox[3] - westBox[1];
    const band = (reverse ? reversedGap : gap) * k;
    const eastTx = x - (eastBox[0] + eastBox[2]) / 2;
    const westTx = x - (westBox[0] + westBox[2]) / 2;
    const eastTy = reverse ? y + westH + band - eastBox[1] : y - eastBox[1];
    const westTy = reverse ? y - westBox[1] : y + eastH + band - westBox[1];
    const eastRect = shift(eastBox, eastTx, eastTy);
    const westRect = shift(westBox, westTx, westTy);


    const alaskaLeft = westRect[0] - margin * k;
    const alaskaTop = westRect[3] + (margin - alaskaSize[1]) * k;
    const alaskaExtent = rect(
      alaskaLeft,
      alaskaTop,
      alaskaLeft + alaskaSize[0] * k,
      alaskaTop + alaskaSize[1] * k
    );
    const hawaiiExtent = rect(
      alaskaLeft + hawaiiShift[0] * k,
      alaskaTop + hawaiiShift[1] * k,
      alaskaLeft + (hawaiiShift[0] + hawaiiSize[0]) * k,
      alaskaTop + (hawaiiShift[1] + hawaiiSize[1]) * k
    );

    lower48EPoint = lower48E.translate([eastTx, eastTy]).stream(pointStream);
    lower48WPoint = lower48W.translate([westTx, westTy]).stream(pointStream);

    alaskaPoint = alaska
        .translate([alaskaLeft + alaskaOffset[0] * k, alaskaTop + alaskaOffset[1] * k])
        .clipExtent(alaskaExtent)
        .stream(pointStream);

    hawaiiPoint = hawaii
        .translate([
          alaskaLeft + hawaiiShift[0] * k + hawaiiOffset[0] * k,
          alaskaTop + hawaiiShift[1] * k + hawaiiOffset[1] * k
        ])
        .clipExtent(hawaiiExtent)
        .stream(pointStream);

    eastHit = pixelBox(lower48E, eastRing);
    westHit = pixelBox(lower48W, westRing);
    alaskaBounds = geographicBounds(alaska.invert, alaskaExtent);
    hawaiiBounds = geographicBounds(hawaii.invert, hawaiiExtent);
    clips = [
      [alaskaExtent, alaska],
      [hawaiiExtent, hawaii]
    ];

    if (puertoRico) {
      const puertoRicoLeft = eastRect[2] - margin * k - puertoRicoSize[0] * k;
      const puertoRicoTop = eastRect[3] - margin * k - puertoRicoSize[1] * k;
      const puertoRicoExtent = rect(
        puertoRicoLeft,
        puertoRicoTop,
        puertoRicoLeft + puertoRicoSize[0] * k,
        puertoRicoTop + puertoRicoSize[1] * k
      );
      puertoRicoPoint = puertoRico
          .translate([puertoRicoLeft + puertoRicoOffset[0] * k, puertoRicoTop + puertoRicoOffset[1] * k])
          .clipExtent(puertoRicoExtent)
          .stream(pointStream);
      puertoRicoBounds = geographicBounds(puertoRico.invert, puertoRicoExtent);
      clips.push([puertoRicoExtent, puertoRico]);
    }

    return reset();
  };

  albersUsaSeam.fitExtent = function(extent, object) {
    return fitExtent(albersUsaSeam, extent, object);
  };

  albersUsaSeam.fitSize = function(size, object) {
    return fitSize(albersUsaSeam, size, object);
  };

  albersUsaSeam.fitWidth = function(width, object) {
    return fitWidth(albersUsaSeam, width, object);
  };

  albersUsaSeam.fitHeight = function(height, object) {
    return fitHeight(albersUsaSeam, height, object);
  };

  function reset() {
    cache = cacheStream = null;
    return albersUsaSeam;
  }

  return albersUsaSeam.scale(k);
}

function ringBox(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < ring.length; ++i) {
    const x = ring[i][0], y = ring[i][1];
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function pixelBox(projection, points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < points.length; ++i) {
    const p = projection(points[i]);
    if (!p) continue;
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

function shift(box, tx, ty) {
  return [box[0] + tx, box[1] + ty, box[2] + tx, box[3] + ty];
}

function rect(x0, y0, x1, y1) {
  return [[x0 + epsilon, y0 + epsilon], [x1 - epsilon, y1 - epsilon]];
}

function inHit(box, px, py) {
  return px >= box[0] && px <= box[2] && py >= box[1] && py <= box[3];
}
