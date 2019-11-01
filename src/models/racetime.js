const mongoose = require('../utils/db');
const Schema = mongoose.Schema;

const schema = new Schema({
  author: String,
  track: String,
  time: Number,
  device: String,
  timestamp: Number,
  checkpoints: [ Number ]
});

module.exports = mongoose.model('RaceTime', schema);