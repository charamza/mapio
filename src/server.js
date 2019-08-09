'use strict';

const Hapi = require('hapi');
const Crawler = require('./crawler');

// Create a server with a host and port
const server = Hapi.server({
  host: 'localhost',
  port: 8000
});

server.route({
  method: 'GET',
  path: '/',
  handler: async (request, h) => {
    return "Vítej na mapovém serveru!";
  }
});
server.route({
  method: 'GET',
  path: '/dev',
  handler: async (request, h) => {
    const json = await Crawler.getData(15.0983, 50.4301, 0.0418, 0.0169, true);
    return json;
  }
});
server.route({
  method: 'GET',
  path: '/tile/{zoom}/{x}/{y}',
  handler: async (request, h) => {
    const zoom = request.params.zoom;
    const x = request.params.x;
    const y = request.params.y;

    console.log("Karel", zoom, x, y);

    if (!x || !y || !zoom) {
      return { message: "Undefined parameter" };
    }
    
    return await Crawler.getData(x, y, zoom);
  }
});
server.route({
  method: 'GET',
  path: '/dev/{zoom}/{x}/{y}',
  handler: async (request, h) => {
    const zoom = request.params.zoom;
    const x = request.params.x;
    const y = request.params.y;

    console.log("Dev", zoom, x, y);

    if (!x || !y || !zoom) {
      return { message: "Undefined parameter" };
    }

    return await Crawler.getData(x, y, zoom, true);
  }
});
server.route({
  method: 'GET',
  path: '/test',
  handler: async function(request, h) {
    const pos = Crawler.getTileByGeo(15.0983, 50.4301, 14);
    const json = await Crawler.getData(pos.x, pos.y, 14);
    return json;
  }
});

// Start the server
const start = async () => {

  try {
    await server.start();
  }
  catch (err) {
    console.log(err);
    process.exit(1);
  }

  console.log('Server running at:', server.info.uri);
};

start();