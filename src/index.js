import { geoAlbers, geoConicEqualArea } from "d3-geo";
import { geoClipPolygon } from "d3-geo-polygon";

const epsilon = 1e-6;

const boundsStream = (() => {
  let x0 = Infinity,
      y0 = x0,
      x1 = -x0,
      y1 = x1;
  
  const boundsStream = {
    point: boundsPoint,
    lineStart: noop,
    lineEnd: noop,
    polygonStart: noop,
    polygonEnd: noop,
    result: function() {
      let bounds = [[x0, y0], [x1, y1]];
      x1 = y1 = -(y0 = x0 = Infinity);
      return bounds;
    }
  };

  function boundsPoint(x, y) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }  
  
  function noop() {}
  
  return boundsStream;
})();

const geoStream = (() => {
  function streamGeometry(geometry, stream) {
    if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
      streamGeometryType[geometry.type](geometry, stream);
    }
  }

  const streamObjectType = {
    Feature: function(object, stream) {
      streamGeometry(object.geometry, stream);
    },
    FeatureCollection: function(object, stream) {
      let features = object.features, i = -1, n = features.length;
      while (++i < n) streamGeometry(features[i].geometry, stream);
    }
  };

  const streamGeometryType = {
    Sphere: function(object, stream) {
      stream.sphere();
    },
    Point: function(object, stream) {
      object = object.coordinates;
      stream.point(object[0], object[1], object[2]);
    },
    MultiPoint: function(object, stream) {
      let coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) object = coordinates[i], stream.point(object[0], object[1], object[2]);
    },
    LineString: function(object, stream) {
      streamLine(object.coordinates, stream, 0);
    },
    MultiLineString: function(object, stream) {
      let coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamLine(coordinates[i], stream, 0);
    },
    Polygon: function(object, stream) {
      streamPolygon(object.coordinates, stream);
    },
    MultiPolygon: function(object, stream) {
      let coordinates = object.coordinates, i = -1, n = coordinates.length;
      while (++i < n) streamPolygon(coordinates[i], stream);
    },
    GeometryCollection: function(object, stream) {
      let geometries = object.geometries, i = -1, n = geometries.length;
      while (++i < n) streamGeometry(geometries[i], stream);
    }
  };

  function streamLine(coordinates, stream, closed) {
    let i = -1, n = coordinates.length - closed, coordinate;
    stream.lineStart();
    while (++i < n) coordinate = coordinates[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
    stream.lineEnd();
  }

  function streamPolygon(coordinates, stream) {
    let i = -1, n = coordinates.length;
    stream.polygonStart();
    while (++i < n) streamLine(coordinates[i], stream, 1);
    stream.polygonEnd();
  }

  return function(object, stream) {
    if (object && streamObjectType.hasOwnProperty(object.type)) {
      streamObjectType[object.type](object, stream);
    } else {
      streamGeometry(object, stream);
    }
  }
})();

export function geoAlbersUsaVertical() {
  const splitX = 0.363;
  const splitY = reverse => reverse ? 0.430 : 0.459; 
  
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
    
    // Define boundaries for each region in its own normalized space
    const eastYRange = [-0.238, 0.234];
    const westYRange = [-0.225, 0.234];
    const alaskaXRange = [-0.363, -0.176];
    const alaskaYRange = [0.121, 0.234];
    const hawaiiXRange = [-0.176, -0.083];
    const hawaiiYRange = [0.166, 0.227];

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
          [x - bandX, eastY - 0.238 * k],
          [x, eastY + 0.234 * k]
        ])
        .stream(pointStream);

    lower48WPoint = lower48W
        .translate([x, westY])
        .clipExtent([
          [x - splitX * k, westY - 0.225 * k],
          [x, westY + 0.234 * k]
        ])
        .stream(pointStream);

    alaskaPoint = alaska
        .translate([x - 0.265 * k, westY + 0.198 * k])
        .clipExtent([
          [x - splitX * k + epsilon, westY + 0.121 * k + epsilon],
          [x - 0.176 * k - epsilon, westY + 0.234 * k - epsilon]
        ])
        .stream(pointStream);

    hawaiiPoint = hawaii
        .translate([x - 0.170 * k, westY + 0.208 * k])
        .clipExtent([
          [x - 0.176 * k + epsilon, westY + 0.166 * k + epsilon],
          [x - 0.083 * k - epsilon, westY + 0.227 * k - epsilon]
        ])
        .stream(pointStream);

    // Clipping seam is relative to the eastern block's position
    const seam = [
      [x, eastY - 0.238 * k],
      [x, eastY + 0.234 * k]
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

function multiplex(streams) {
  const n = streams.length;
  return {
    point: (x, y) => { let i = -1; while (++i < n) streams[i].point(x, y); },
    sphere: () => { let i = -1; while (++i < n) streams[i].sphere(); },
    lineStart: () => { let i = -1; while (++i < n) streams[i].lineStart(); },
    lineEnd: () => { let i = -1; while (++i < n) streams[i].lineEnd(); },
    polygonStart: () => { let i = -1; while (++i < n) streams[i].polygonStart(); },
    polygonEnd: () => { let i = -1; while (++i < n) streams[i].polygonEnd(); }
  };
}

function fitExtent(projection, extent, object) {
  return fit(projection, b => {
    const w = extent[1][0] - extent[0][0],
          h = extent[1][1] - extent[0][1],
          k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])),
          x = +extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2,
          y = +extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;
    projection.scale(150 * k).translate([x, y]);
  }, object);
}

function fitSize(projection, size, object) {
  return fitExtent(projection, [[0, 0], size], object);
}

function fit(projection, fitBounds, object) {
  const clip = projection.clipExtent && projection.clipExtent();
  projection.scale(150).translate([0, 0]);
  if (clip != null) projection.clipExtent(null);
  geoStream(object, projection.stream(boundsStream));
  fitBounds(boundsStream.result());
  if (clip != null) projection.clipExtent(clip);
  return projection;
}

function fitWidth(projection, width, object) {
  return fit(projection, function(b) {
    const w = +width,
          k = w / (b[1][0] - b[0][0]),
          x = (w - k * (b[1][0] + b[0][0])) / 2,
          y = -k * b[0][1];
    projection.scale(150 * k).translate([x, y]);
  }, object);
}

function fitHeight(projection, height, object) {
  return fit(projection, function(b) {
    const h = +height,
          k = h / (b[1][1] - b[0][1]),
          x = -k * b[0][0],
          y = (h - k * (b[1][1] + b[0][1])) / 2;
    projection.scale(150 * k).translate([x, y]);
  }, object);
}