const fetch = require('node-fetch');
const parser = require('fast-xml-parser');
const he = require('he');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const turf = require('@turf/turf');

var options = {
  attributeNamePrefix: "",
  attrNodeName: "attr", //default is 'false'
  textNodeName: "#text",
  ignoreAttributes: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: "__cdata", //default is 'false'
  cdataPositionChar: "\\c",
  localeRange: "", //To support non english character in tag/attribute values.
  parseTrueNumberOnly: false,
  attrValueProcessor: a => he.decode(a, { isAttributeValue: true }),//default is a=>a
  tagValueProcessor: a => he.decode(a) //default is a=>a
};

const TYPE = { WAY: 'way', BUILDING: 'building', AREA: 'area', UNKNOWN: 'unknown'};
const TILE_SIZE = zoom => 180.0 / Math.pow(2, zoom);

const getType = way => {
  if ((way.highway || way.waterway) && !way.area) {
    return { type: TYPE.WAY, subtype: way.highway || way.waterway, footway: way.footway };
  }
  if (way.building) {
    let type = way.building != 'yes' ? way.building : undefined;
    return { type: TYPE.BUILDING, subtype: type };
  }
  if (way.area || way.landuse || way.natural || way.leisure) {
    return { type: TYPE.AREA, subtype: way.natural || way.landuse || way.leisure || way.highway };
  }

  return { type: TYPE.UNKNOWN };
};

const getTagData = tags => {
  if (!tags) return {};
  if (!Array.isArray(tags)) tags = [tags];

  return tags.reduce((acc, tag) => {
    acc[tag.attr.k] = tag.attr.v;
    return acc;
  }, {});
}

const getData = (y, x, zoom, isDev = false) => {
  const tile = getTileBBox(x, y, zoom);
  const bbox = [tile.x, tile.y, tile.x + tile.width, tile.y + tile.height].join(',');

  const fileName = 'z' + zoom + 'x' + x + 'y' + y + '.json';
  const filePath = path.join(__dirname, '..', '/cache/', fileName);

  if (false && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }

  return fetch('https://www.openstreetmap.org/api/0.6/map?bbox=' + bbox)
  .then(res => {
    const text = res.text();
    return text;
  })
  .then(xml => parser.getTraversalObj(xml, options))
  .then(obj => {
    const data = parser.convertToJson(obj, options).osm;
    return data;
  })
  .then(json => {
    if (!json.node || !json.way) return {};
    const nodes = {};
    const ways = {};
    let tmp = {};

    Object.keys(TYPE).forEach(key => tmp[TYPE[key]] = []);

    const closeShape = points => {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.x != last.x || first.y != last.y) points.push(first);
      return points;
    }

    const getShape = nds => {
      return (nds || []).map(nd => {
        node = nodes[nd.attr.ref];

        const x = Math.floor((node.attr.lat - tile.y) / TILE_SIZE(zoom) * 4096);
        const y = Math.floor((node.attr.lon - tile.x) / TILE_SIZE(zoom) * 4096);

        return {x, y};
      });
    }
    const process = (way, nds) => {
      const id = way.attr.id;
      const tags = getTagData(way.tag);
      const type = getType(tags);

      if (type.subtype == 'weir') return;
      if (tags.crossing) return;
      
      let obj = {
        type: type.subtype,
        shape: getShape(nds || way.nd)
      };

      if (isDev) obj.id = id;
      if (type.type == "area") obj.shape = closeShape(obj.shape);

      if (obj.type == "forest") {
        const polygon = turf.polygon([[ ...obj.shape.map(p => [p.x, p.y]) ]]);
        const clipped = turf.bboxClip(polygon, [0, 0, 4096, 4096]);
        obj.shape = clipped.geometry.coordinates[0].map(p => ({ x: p[0], y: p[1] }));
      }

      tmp[type.type].push(obj);
      ways[id] = way;
      return obj;
    };

    if (json.relation && !Array.isArray(json.relation)) json.relation = [json.relation];

    (json.node || []).forEach(node => nodes[node.attr.id] = node);
    (json.way || []).forEach(way => process(way));
    (json.relation || []).forEach(relation => {
      if (!Array.isArray(relation.member)) relation.member = [relation.member];
      const tags = getTagData(relation.tag);

      if (tags.boundary == "administrative") return;

      let outerWay = null;
      let innerWays = relation.member.reduce((list, member) => {
        const ref = parseInt(member.attr.ref);

        if (typeof ways[ref] !== 'undefined') {
          const way = ways[ref];
          if (member.attr.role == "outer") outerWay = way;
          else list.push(way);
        }

        return list;
      }, []);

      if (!outerWay) {
        console.log(JSON.stringify(relation));
        return;
      }

      const outer = process(relation, outerWay.nd);
      outer.inner = innerWays.map(inner => getShape(inner.nd));
    });

    delete tmp.unknown;

    return tmp;
  }).then(json => {
    fs.writeFile(filePath, JSON.stringify(json), 'ascii', err => {
      if (err) console.log('Error caching', fileName);
    });

    return json;
  })
  .catch(error => {
    console.log(error);
    return {
      type: "error",
      message: error.message,
    }
  });
}

const zoomSize = level => 180 / Math.pow(2, level);

const getTileByGeo = (latitude, longitude, zoomLevel) => {
  const zoom = zoomSize(zoomLevel);
  const x = Math.floor(longitude / zoom);
  const y = Math.floor(latitude / zoom);
  return { x, y };
}

const getTileBBox = (x, y, zoomLevel) => {
  const zoom = zoomSize(zoomLevel);
  //const {x, y} = getTileByGeo(latitude, longitude);
  return { x: x * zoom, y: y * zoom, width: zoom, height: zoom };
}


module.exports = {
  getData: getData,
  getTileByGeo: getTileByGeo,
  getTileBBox: getTileBBox
};