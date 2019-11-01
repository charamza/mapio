module.exports = (req, res) => {
  require('dotenv').config()
  res.json({ status: "Success", data: process.env });
};