const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const todoSchema = new Schema({
      todo: {
            type: String,
      },
      username: {
            type: String,
      },
});

module.exports = mongoose.model('Todo', todoSchema);
