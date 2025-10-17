import { geoAlbers, geoConicEqualArea } from "d3-geo";
import { geoClipPolygon } from "d3-geo-polygon";

import { 
  splitX,
  splitY,
  eastYRange,
  westYRange,
  alaskaXRange,
  alaskaYRange,
  hawaiiXRange,
  hawaiiYRange,
  epsilon
} from "./constants.js";

import {
  fitExtent,
  fitHeight,
  fitSize,
  fitWidth,
  multiplex
} from "./geo.js";

export default function geoAlbersUsaVertical() { 
  let cache,
      cacheStream,
      lower48E = geoAlbers(), lower48EPoint,
      lower48W = geoAlbers(), lower48WPoint,
      alaska = geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]),
      alaskaPoint,
      hawaii = geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]),
      hawaiiPoint,
      point,
      pointStream = {point: function(x, y) { point = [x, y]; }};
    
  // Main projection state
  let k = 1070, x = 480, y = 250, reverse = false;

  function albersUsaVertical(coordinates) {
    const lon = coordinates[0], lat = coordinates[1];
    return point = null,
        (lower48EPoint.point(lon, lat), point) ||
        (lower48WPoint.point(lon, lat), point) ||
        (alaskaPoint.point(lon, lat), point) ||
        (hawaiiPoint.point(lon, lat), point);
  }

  albersUsaVertical.invert = function(coordinates) {
    // Normalized coordinates relative to the top projection's frame
    const topProjection = reverse ? lower48W : lower48E;
    const t_top = topProjection.translate();
    const x_norm = (coordinates[0] - t_top[0]) / k;
    const y_norm = (coordinates[1] - t_top[1]) / k;

    // East is on top
    if (!reverse) {
      if (y_norm >= eastYRange[0] && y_norm < eastYRange[1]) {
        return lower48E.invert(coordinates);
      }
      // Shift coords to be relative to the bottom (West) block's frame
      const yb = y_norm - splitY(reverse);
      const xb = x_norm - splitX;
      if (yb >= alaskaYRange[0] && yb < alaskaYRange[1] && xb >= alaskaXRange[0] && xb < alaskaXRange[1]) {
        return alaska.invert(coordinates);
      }
      if (yb >= hawaiiYRange[0] && yb < hawaiiYRange[1] && xb >= hawaiiXRange[0] && xb < hawaiiXRange[1]) {
        return hawaii.invert(coordinates);
      }
      return lower48W.invert(coordinates);
    }

    // West is on top
    else { 
      if (y_norm >= westYRange[0] && y_norm < westYRange[1]) {
        // Coords are already relative to the west frame
        if (y_norm >= alaskaYRange[0] && y_norm < alaskaYRange[1] && x_norm >= alaskaXRange[0] && x_norm < alaskaXRange[1]) {
          return alaska.invert(coordinates);
        }
        if (y_norm >= hawaiiYRange[0] && y_norm < hawaiiYRange[1] && x_norm >= hawaiiXRange[0] && x_norm < hawaiiXRange[1]) {
          return hawaii.invert(coordinates);
        }
        return lower48W.invert(coordinates);
      }
      
      return lower48E.invert(coordinates);
    }
  };

  albersUsaVertical.stream = function(stream) {
    return cache && cacheStream === stream ?
      cache :
      cache = multiplex([
        lower48E.stream(cacheStream = stream),
        lower48W.stream(stream),
        alaska.stream(stream),
        hawaii.stream(stream)
      ]);
  };

  albersUsaVertical.precision = function(_) {
    if (!arguments.length) return lower48E.precision();
    lower48E.precision(_), lower48W.precision(_), alaska.precision(_), hawaii.precision(_);
    return reset();
  };

  albersUsaVertical.scale = function(_) {
    if (!arguments.length) return k;
    k = +_;
    return albersUsaVertical.translate([x, y]);
  };
  
  albersUsaVertical.reverse = function(_) {
    if (!arguments.length) return reverse;
    reverse = !!_;
    return albersUsaVertical.translate([x, y]);
  };

  albersUsaVertical.translate = function(_) {
    if (!arguments.length) return [x, y];
    x = +_[0];
    y = +_[1];
    
    // Set scales on component projections
    lower48E.scale(k), lower48W.scale(k), alaska.scale(k * 0.35), hawaii.scale(k);
    
    const bandY = splitY(reverse) * k,
          bandX = splitX * k;

    // Determine the y-offsets based on the reverse flag
    const eastY = reverse ? y + bandY : y;
    const westY = reverse ? y : y + bandY;

    lower48EPoint = lower48E
        .translate([x - bandX, eastY])
        .clipExtent([
          [x - bandX, eastY + eastYRange[0] * k],
          [x, eastY + eastYRange[1] * k]
        ])
        .stream(pointStream);

    lower48WPoint = lower48W
        .translate([x, westY])
        .clipExtent([
          [x - splitX * k, westY + westYRange[0] * k],
          [x, westY + westYRange[1] * k]
        ])
        .stream(pointStream);

    alaskaPoint = alaska
        .translate([x - 0.265 * k, westY + 0.198 * k])
        .clipExtent([
          [x + alaskaXRange[0] * k + epsilon, westY + alaskaYRange[0] * k + epsilon],
          [x + alaskaXRange[1] * k - epsilon, westY + alaskaYRange[1] * k - epsilon]
        ])
        .stream(pointStream);

    hawaiiPoint = hawaii
        .translate([x - 0.170 * k, westY + 0.208 * k])
        .clipExtent([
          [x + hawaiiXRange[0] * k + epsilon, westY + hawaiiYRange[0] * k + epsilon],
          [x + hawaiiXRange[1] * k - epsilon, westY + hawaiiYRange[1] * k - epsilon]
        ])
        .stream(pointStream);

    // Clipping seam is relative to the eastern block's position
    const seam = [
      [x, eastY + eastYRange[0] * k],
      [x, eastY + eastYRange[1] * k]
    ].map(lower48E.invert);

    lower48E.preclip(geoClipPolygon({
      type: "Polygon",
      coordinates: [[
        ...seam,
        [seam[1][0], -90],
        [seam[0][0], 90]
      ]]
    }));

    return reset();
  };
  
  albersUsaVertical.fitExtent = function(extent, object) {
    return fitExtent(albersUsaVertical, extent, object);
  };

  albersUsaVertical.fitSize = function(size, object) {
    return fitSize(albersUsaVertical, size, object);
  };

  albersUsaVertical.fitWidth = function(width, object) {
    return fitWidth(albersUsaVertical, width, object);
  };

  albersUsaVertical.fitHeight = function(height, object) {
    return fitHeight(albersUsaVertical, height, object);
  };

  function reset() {
    cache = cacheStream = null;
    return albersUsaVertical;
  }

  return albersUsaVertical.scale(k);
}