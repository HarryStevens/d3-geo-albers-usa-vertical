import { geoAlbers, geoConicEqualArea } from "d3-geo";

import { 
  splitX,
  splitY,
  eastYRange,
  westYRange,
  alaskaXRange,
  alaskaYRange,
  hawaiiXRange,
  hawaiiYRange,
  puertoRicoXRange,
  puertoRicoYRange,
  epsilon
} from "./constants.js";

import {
  covers,
  dispatch,
  fitExtent,
  fitHeight,
  fitSize,
  fitWidth,
  geographicBounds
} from "./geo.js";

// The lower 48 does not cross the antimeridian. The default antimeridian clip
// treats a small counterclockwise ring as the outside of the world and fills
// the whole panel.
const passThrough = stream => stream;

export default function geoAlbersUsaPrVertical() {
  let cache,
      cacheStream,
      lower48E = geoAlbers().preclip(passThrough), lower48EPoint,
      lower48W = geoAlbers().preclip(passThrough), lower48WPoint,
      alaska = geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]),
      alaskaPoint,
      hawaii = geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]),
      hawaiiPoint,
      puertoRico = geoConicEqualArea().rotate([66, 0]).center([0, 18]).parallels([8, 18]),
      puertoRicoPoint,
      point,
      pointStream = {point: function(x, y) { point = [x, y]; }},
      eastBounds, westBounds, alaskaBounds, hawaiiBounds, puertoRicoBounds,
      clips;
    
  // Main projection state
  let k = 1070, x = 480, y = 250, reverse = false;

  function albersUsaPrVertical(coordinates) {
    const lon = coordinates[0], lat = coordinates[1];
    if (covers(eastBounds, lon, lat)) {
      point = null;
      lower48EPoint.point(lon, lat);
      if (point) return point;
    }
    if (covers(westBounds, lon, lat)) {
      point = null;
      lower48WPoint.point(lon, lat);
      if (point) return point;
    }
    if (covers(alaskaBounds, lon, lat)) {
      point = null;
      alaskaPoint.point(lon, lat);
      if (point) return point;
    }
    if (covers(hawaiiBounds, lon, lat)) {
      point = null;
      hawaiiPoint.point(lon, lat);
      if (point) return point;
    }
    if (covers(puertoRicoBounds, lon, lat)) {
      point = null;
      puertoRicoPoint.point(lon, lat);
      if (point) return point;
    }
    return null;
  }

  albersUsaPrVertical.invert = function(coordinates) {
    const px = coordinates[0], py = coordinates[1];
    for (let i = 0; i < clips.length; ++i) {
      const extent = clips[i][0];
      if (px >= extent[0][0] && px <= extent[1][0] && py >= extent[0][1] && py <= extent[1][1]) {
        return clips[i][1].invert(coordinates);
      }
    }
    return null;
  };

  albersUsaPrVertical.stream = function(stream) {
    return cache && cacheStream === stream ? cache : cache = dispatch([
      [lower48E.stream(cacheStream = stream), eastBounds],
      [lower48W.stream(stream), westBounds],
      [alaska.stream(stream), alaskaBounds],
      [hawaii.stream(stream), hawaiiBounds],
      [puertoRico.stream(stream), puertoRicoBounds]
    ]);
  };

  albersUsaPrVertical.precision = function(_) {
    if (!arguments.length) return lower48E.precision();
    lower48E.precision(_), lower48W.precision(_), alaska.precision(_), hawaii.precision(_), puertoRico.precision(_);
    return reset();
  };

  albersUsaPrVertical.scale = function(_) {
    if (!arguments.length) return k;
    k = +_;
    return albersUsaPrVertical.translate([x, y]);
  };
  
  albersUsaPrVertical.reverse = function(_) {
    if (!arguments.length) return reverse;
    reverse = !!_;
    return albersUsaPrVertical.translate([x, y]);
  };

  albersUsaPrVertical.translate = function(_) {
    if (!arguments.length) return [x, y];
    x = +_[0];
    y = +_[1];
    
    // Set scales on component projections
    lower48E.scale(k), lower48W.scale(k), alaska.scale(k * 0.35), hawaii.scale(k), puertoRico.scale(k);
    
    const bandY = splitY(reverse) * k,
          bandX = splitX * k;

    // Determine the y-offsets based on the reverse flag
    const eastY = reverse ? y + bandY : y;
    const westY = reverse ? y : y + bandY;

    const eastExtent = [
      [x - bandX, eastY + eastYRange[0] * k],
      [x, eastY + eastYRange[1] * k]
    ];
    const westExtent = [
      [x - bandX, westY + westYRange[0] * k],
      [x, westY + westYRange[1] * k]
    ];
    const alaskaExtent = [
      [x + alaskaXRange[0] * k + epsilon, westY + alaskaYRange[0] * k + epsilon],
      [x + alaskaXRange[1] * k - epsilon, westY + alaskaYRange[1] * k - epsilon]
    ];
    const hawaiiExtent = [
      [x + hawaiiXRange[0] * k + epsilon, westY + hawaiiYRange[0] * k + epsilon],
      [x + hawaiiXRange[1] * k - epsilon, westY + hawaiiYRange[1] * k - epsilon]
    ];
    const puertoRicoExtent = [
      [x - bandX + puertoRicoXRange[0] * k, eastY + puertoRicoYRange[0] * k],
      [x - bandX + puertoRicoXRange[1] * k, eastY + puertoRicoYRange[1] * k]
    ];

    lower48EPoint = lower48E
        .translate([x - bandX, eastY])
        .clipExtent(eastExtent)
        .stream(pointStream);

    lower48WPoint = lower48W
        .translate([x, westY])
        .clipExtent(westExtent)
        .stream(pointStream);

    alaskaPoint = alaska
        .translate([x - 0.265 * k, westY + 0.198 * k])
        .clipExtent(alaskaExtent)
        .stream(pointStream);

    hawaiiPoint = hawaii
        .translate([x - 0.170 * k, westY + 0.208 * k])
        .clipExtent(hawaiiExtent)
        .stream(pointStream);

    puertoRicoPoint = puertoRico
        .translate([x - bandX + 0.339 * k, eastY + 0.224 * k])
        .clipExtent(puertoRicoExtent)
        .stream(pointStream);

    eastBounds = geographicBounds(lower48E.invert, eastExtent);
    westBounds = geographicBounds(lower48W.invert, westExtent);
    alaskaBounds = geographicBounds(alaska.invert, alaskaExtent);
    hawaiiBounds = geographicBounds(hawaii.invert, hawaiiExtent);
    puertoRicoBounds = geographicBounds(puertoRico.invert, puertoRicoExtent);
    // Insets overlap their parent panel in pixel space, so test them first.
    clips = [
      [alaskaExtent, alaska],
      [hawaiiExtent, hawaii],
      [puertoRicoExtent, puertoRico],
      [eastExtent, lower48E],
      [westExtent, lower48W]
    ];

    return reset();
  };
  
  albersUsaPrVertical.fitExtent = function(extent, object) {
    return fitExtent(albersUsaPrVertical, extent, object);
  };

  albersUsaPrVertical.fitSize = function(size, object) {
    return fitSize(albersUsaPrVertical, size, object);
  };

  albersUsaPrVertical.fitWidth = function(width, object) {
    return fitWidth(albersUsaPrVertical, width, object);
  };

  albersUsaPrVertical.fitHeight = function(height, object) {
    return fitHeight(albersUsaPrVertical, height, object);
  };

  function reset() {
    cache = cacheStream = null;
    return albersUsaPrVertical;
  }

  return albersUsaPrVertical.scale(k);
}
