const Crawler = require('./crawler');
const { parse } = require("url");

module.exports = async (req, res) => {
  const { query } = parse(req.url, true);
  const { zoom, x, y } = query;
  

  if (!x || !y || !zoom) {
    return { message: "Undefined parameter" };
  }

  const data = await Crawler.getData(x, y, zoom, true);

  res.json(data);
};