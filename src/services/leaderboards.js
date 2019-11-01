const RaceTime = require('../models/racetime.js');



async function addTime(track, author, checkpoints, device) {
  const time = checkpoints.slice(-1).pop();
  const timestamp = Date.now();

  return RaceTime.create({ track, author, time, checkpoints, device, timestamp });
}

async function getLeaderboards(track) {
  return RaceTime.find({ track }, { _id: 0, author: 1, time: 1 }, { skip: 0, limit: 10, sort: { time: 1 } });
} 

module.exports = {
  addTime,
  getLeaderboards
};