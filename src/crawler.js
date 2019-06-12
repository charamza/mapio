const fetch = require('node-fetch');
const parser = require('fast-xml-parser');
const he = require('he');
const fs = require('fs');
const _ = require('lodash');

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
const TILE_SIZE = 180.0 / Math.pow(2, 14);

const getType = way => {
  if (way.highway || way.waterway) {
    return { type: TYPE.WAY, subtype: way.highway || way.waterway };
  }
  if (way.building) {
    let type = way.building != 'yes' ? way.building : undefined;
    return { type: TYPE.BUILDING, subtype: type };
  }
  if (way.area || way.landuse || way.natural) {
    return { type: TYPE.AREA, subtype: way.natural || way.landuse };
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

  return fetch('https://www.openstreetmap.org/api/0.6/map?bbox=' + bbox)
  .then(res => res.text())
  .then(xml => parser.getTraversalObj(xml, options))
  .then(obj => parser.convertToJson(obj, options).osm)
  .then(json => {
    if (!json.node || !json.way) return {};
    const nodes = {};
    let tmp = {};

    Object.keys(TYPE).forEach(key => tmp[TYPE[key]] = []);

    json.node.forEach(node => nodes[node.attr.id] = node);
    json.way.forEach(way => {
      const tags = getTagData(way.tag);
      const type = getType(tags);
      
      let obj;
      if (isDev) {
        obj = {
          id: parseInt(way.attr.id, 10),
          type: type.subtype,
          shape: []
        };
      } else {
        obj = {
          type: type.subtype,
          shape: []
        };
      }

      const nds = way.nd || [];
      nds.forEach(nd => {
        node = nodes[nd.attr.ref];

        const x = Math.floor((node.attr.lat - tile.y) / TILE_SIZE * 4096);
        const y = Math.floor((node.attr.lon - tile.x) / TILE_SIZE * 4096);

        obj.shape.push({x, y});
      });

      tmp[type.type].push(obj);
    });

    delete tmp.unknown;

    return tmp;
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
  getTileBBox: getTileBBox,
  TILE_SIZE: TILE_SIZE
};