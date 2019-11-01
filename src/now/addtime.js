const Leaderboards = require('../services/leaderboards');
const { parse } = require("url");

module.exports = async (req, res) => {
  try {
    const { track } = req.query;
    const splitted = (decodeURI(req.body) || "").split(";");

    if (splitted.length != 3) {
      return res.status(400).json({ status: "Error" });
    }

    const author = splitted[0];
    const checkpoints = splitted[1].split(":").map(val => val.replace(',', '.'));
    const device = splitted[2];

    if (checkpoints.length < 2) {
      return res.status(400).json({ status: "Error" });
    }

    const data = await Leaderboards.addTime(track, author, checkpoints, device);

    console.log(data);

    res.json({ status: "Success", data: data });
  } catch (e) { console.error(e); }
};