const Leaderboards = require('../services/leaderboards');
const { parse } = require("url");

module.exports = async (req, res) => {
  const { query } = parse(req.url, true);
  const { track } = query;

  const data = await Leaderboards.getLeaderboards(track);

  res.json({ status: "Success", data: data });
};