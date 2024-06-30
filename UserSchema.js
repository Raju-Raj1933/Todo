const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
      name:{
            type: "string",
      },
      email: {
            type: "string",
      },
      password: {
            type: "string",
      },
      username: {
            type: "string",
      },
});

module.exports = mongoose.model("users", UserSchema);