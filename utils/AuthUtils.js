const validator = require("validator");

const cleanUpAndValidate = ({ name, password, username, email }) => {
  return new Promise((resolve, reject) => {
    if (!name || !email || !password) reject("Fill all column");
    if (typeof email !== "string") reject("Invalid Email");
    if (typeof password !== "string") reject("Invalid Password");
    if (typeof name !== "string") reject("Invalid name");
    if (typeof username !== "string") reject("Invalid username");
    if (username.length < 3) reject("username to short");
    if (!validator.isEmail(email)) reject("Invalid email");

    resolve();
  });
};

module.exports = {cleanUpAndValidate};