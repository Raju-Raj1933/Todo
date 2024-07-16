const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
      name:{
            type: String,
      },
      email: {
            type: String,
      },
      password: {
            type: String,
      },
      username: {
            type: String,
      },
      emailAuthenticated:{
            type: Boolean,
      },
});

module.exports = mongoose.model("users", UserSchema);