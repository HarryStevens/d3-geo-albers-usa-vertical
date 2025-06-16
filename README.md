# d3-geo-hemispheres

A map projection compatible with [d3-geo](https://d3js.org/d3-geo) for drawing an adaptation of the [Albers USA projection](https://d3js.org/d3-geo/conic#geoAlbersUsa) for vertical screens.

## Installing

If you use NPM, `npm install d3-geo-albers-usa-vertical`.

```js
import { geoAlbersUsaVertical } from "d3-geo-albers-usa-vertical";

const projection = geoAlbersUsaVertical();
```

[Try d3-geo-albers-usa-vertical in your browser](https://observablehq.com/@harrystevens/d3-geo-albers-usa-vertical).

## API Reference

The projection works like a [d3-geo projection](https://d3js.org/d3-geo/projection).

<a name="geoAlbersUsaVertical" href="#geoAlbersUsaVertical">#</a> d3.<b>geoAlbersUsaVertical</b>() · [Source](https://github.com/HarryStevens/d3-geo-albers-usa-vertical/blob/main/src/index.js)

This is a U.S.-centric composite projection of four [geoConicEqualArea](https://d3js.org/d3-geo/conic#geoConicEqualArea) projections: On the top half of the map, [geoAlbers](https://d3js.org/d3-geo/conic#geoAlbers) is used for the eastern part of the lower fourty-eight states. On the bottom half of the map, geoAlbers is used for the western part of the lower forty-eight states, and separate conic equal-area projections are used for Alaska and Hawaii. The scale for Alaska is diminished: it is projected at one-third its true relative area.

The constituent projections have fixed clip, center and rotation, and thus this projection does not support [<i>projection</i>.center](https://d3js.org/d3-geo/projection#projection_center), [<i>projection</i>.rotate](https://d3js.org/d3-geo/projection#projection_rotate), [<i>projection</i>.clipAngle](https://d3js.org/d3-geo/projection#projection_clipAngle), or [<i>projection</i>.clipExtent](https://d3js.org/d3-geo/projection#projection_clipExtent).