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

const maxEdge = 15;

function normalize(lon) {
  return lon - 360 * Math.floor((lon + 180) / 360);
}

// Geographic coverage of a clip rectangle. Sampled through that sub-projection's
// invert, so it stays valid at any scale or translate. pad is in degrees.
export function geographicBounds(invert, extent, pad = 1.5) {
  const x0 = extent[0][0], y0 = extent[0][1], x1 = extent[1][0], y1 = extent[1][1];
  const lons = [];
  let lat0 = Infinity, lat1 = -Infinity;
  const steps = 12;

  function sample(point) {
    if (!point) return;
    const lon = point[0], lat = point[1];
    if (lon !== lon || lat !== lat) return;
    lons.push(normalize(lon));
    if (lat < lat0) lat0 = lat;
    if (lat > lat1) lat1 = lat;
  }

  for (let i = 0; i <= steps; ++i) {
    const t = i / steps;
    sample(invert([x0 + (x1 - x0) * t, y0]));
    sample(invert([x0 + (x1 - x0) * t, y1]));
    sample(invert([x0, y0 + (y1 - y0) * t]));
    sample(invert([x1, y0 + (y1 - y0) * t]));
  }
  sample(invert([(x0 + x1) / 2, (y0 + y1) / 2]));

  if (!lons.length) return {anyLon: true, lat0: -90, lat1: 90};

  lons.sort((a, b) => a - b);
  let maxGap = lons[0] + 360 - lons[lons.length - 1];
  let split = 0;
  for (let i = 1; i < lons.length; ++i) {
    const gap = lons[i] - lons[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      split = i;
    }
  }

  let lon0, lon1, wrap;
  if (split === 0) {
    lon0 = lons[0];
    lon1 = lons[lons.length - 1];
    wrap = false;
  } else {
    lon0 = lons[split];
    lon1 = lons[split - 1];
    wrap = true;
  }

  lat0 = Math.max(-90, lat0 - pad);
  lat1 = Math.min(90, lat1 + pad);
  lon0 -= pad;
  lon1 += pad;

  if (!wrap) {
    if (lon1 - lon0 >= 360) return {anyLon: true, lat0, lat1};
    if (lon0 < -180) {
      wrap = true;
      lon0 += 360;
    } else if (lon1 > 180) {
      wrap = true;
      lon1 -= 360;
    }
  } else if (lon0 <= lon1) {
    return {anyLon: true, lat0, lat1};
  }

  return {anyLon: false, wrap, lon0, lon1, lat0, lat1};
}

export function covers(region, lon, lat) {
  if (lat < region.lat0 || lat > region.lat1) return false;
  if (region.anyLon) return true;
  if (!region.wrap) return lon >= region.lon0 && lon <= region.lon1;
  return lon >= region.lon0 || lon <= region.lon1;
}

function overlaps(region, lon0, lat0, lon1, lat1) {
  if (lat1 < region.lat0 || lat0 > region.lat1) return false;
  if (region.anyLon) return true;
  if (!region.wrap) return lon1 >= region.lon0 && lon0 <= region.lon1;
  return lon1 >= region.lon0 || lon0 <= region.lon1;
}

// Like multiplex, but each geometry is replayed only into the sub-projections
// whose geographic coverage intersects it. entries are [stream, region].
export function dispatch(entries) {
  const n = entries.length;
  const streams = new Array(n);
  const regions = new Array(n);
  const use = new Array(n);
  for (let i = 0; i < n; ++i) {
    streams[i] = entries[i][0];
    regions[i] = entries[i][1];
  }

  const xs = [];
  const ys = [];
  const ringStarts = [];
  const ringEnds = [];
  let npts = 0;
  let nrings = 0;
  let rings = false;
  let buffering = false;
  let long = false;
  let started = false;
  let prevX = 0;
  let prevY = 0;
  let ringAt = 0;

  function record(x, y) {
    if (started) {
      const dlon = Math.abs(x - prevX);
      if ((dlon > maxEdge && dlon < 360 - maxEdge) || Math.abs(y - prevY) > maxEdge) long = true;
    } else {
      started = true;
    }
    xs[npts] = x;
    ys[npts] = y;
    prevX = x;
    prevY = y;
    ++npts;
  }

  function choose(start, end) {
    if (long) {
      for (let i = 0; i < n; ++i) use[i] = true;
      return;
    }
    let lon0 = Infinity, lon1 = -Infinity, lat0 = Infinity, lat1 = -Infinity;
    for (let i = start; i < end; ++i) {
      const x = xs[i], y = ys[i];
      if (x < lon0) lon0 = x;
      if (x > lon1) lon1 = x;
      if (y < lat0) lat0 = y;
      if (y > lat1) lat1 = y;
    }
    for (let i = 0; i < n; ++i) use[i] = overlaps(regions[i], lon0, lat0, lon1, lat1);
  }

  function replay(start, end, stream) {
    stream.lineStart();
    for (let i = start; i < end; ++i) stream.point(xs[i], ys[i]);
    stream.lineEnd();
  }

  return {
    point(x, y) {
      if (buffering) record(x, y);
      else {
        for (let i = 0; i < n; ++i) if (covers(regions[i], x, y)) streams[i].point(x, y);
      }
    },
    sphere() {
      for (let i = 0; i < n; ++i) streams[i].sphere();
    },
    lineStart() {
      buffering = true;
      started = false;
      ringAt = npts;
      if (!rings) {
        npts = 0;
        ringAt = 0;
        long = false;
      }
    },
    lineEnd() {
      buffering = false;
      if (rings) {
        ringStarts[nrings] = ringAt;
        ringEnds[nrings] = npts;
        ++nrings;
      } else if (npts) {
        choose(0, npts);
        for (let i = 0; i < n; ++i) if (use[i]) replay(0, npts, streams[i]);
      }
    },
    polygonStart() {
      rings = true;
      nrings = 0;
      npts = 0;
      long = false;
    },
    polygonEnd() {
      if (npts) {
        choose(0, npts);
        for (let i = 0; i < n; ++i) {
          if (!use[i]) continue;
          const stream = streams[i];
          stream.polygonStart();
          for (let j = 0; j < nrings; ++j) replay(ringStarts[j], ringEnds[j], stream);
          stream.polygonEnd();
        }
      }
      rings = false;
    }
  };
}

export function fitExtent(projection, extent, object) {
  return fit(projection, b => {
    const w = extent[1][0] - extent[0][0],
          h = extent[1][1] - extent[0][1],
          k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])),
          x = +extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2,
          y = +extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;
    projection.scale(150 * k).translate([x, y]);
  }, object);
}

export function fitSize(projection, size, object) {
  return fitExtent(projection, [[0, 0], size], object);
}

export function fitWidth(projection, width, object) {
  return fit(projection, function(b) {
    const w = +width,
          k = w / (b[1][0] - b[0][0]),
          x = (w - k * (b[1][0] + b[0][0])) / 2,
          y = -k * b[0][1];
    projection.scale(150 * k).translate([x, y]);
  }, object);
}

export function fitHeight(projection, height, object) {
  return fit(projection, function(b) {
    const h = +height,
          k = h / (b[1][1] - b[0][1]),
          x = -k * b[0][0],
          y = (h - k * (b[1][1] + b[0][1])) / 2;
    projection.scale(150 * k).translate([x, y]);
  }, object);
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