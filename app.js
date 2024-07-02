require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const session = require("express-session");
const  mongoDBSession = require("connect-mongodb-session")(session);
const UserSchema = require("./UserSchema");
const { cleanUpAndValidate } = require("./utils/AuthUtils");
const isAuth = require("./utils/middleware");
const TodoModel = require("./models/TodoModel");
const rateLimiting = require("./middleware.js/rateLimiting");

const app = express();
const PORT = process.env.PORT || 8000;
const saltRounds = 15;

const mongoURI = process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET;

mongoose.set("strictQuery", false);
mongoose.connect(mongoURI)
  .then(() => console.log("Connected to MongoDB!"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const store = new  mongoDBSession({
  uri: mongoURI,
  collection: "sessions"
});

store.on("error", (error) => {
  console.error("Session store error:", error);
});

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: store
}));

app.get("/", (req, res) => {
  return res.send('<h1 style="text-align:center; color:#FF0000">Welcome To My ToDo App</h1>');
});

app.get("/register", (req, res) => {
  return res.render("register");
});

app.get("/login", (req, res) => {
  return res.render("login");
});

app.post("/register", async (req, res) => {
  const { name, email, username, password } = req.body;
  try {
    await cleanUpAndValidate({ name, email, password, username });
  } catch (err) {
    return res.status(402).json({ message: err.message });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = new UserSchema({ name, email, password: hashedPassword, username });

    const userAvailability = await UserSchema.findOne({ email });
    if (userAvailability) {
      return res.status(403).json({ message: "User already exists" });
    }

    await user.save();
    return res.redirect("/login");
  } catch (err) {
    console.error("Error registering user:", err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password || typeof loginId !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Invalid Data" });
  }

  try {
    const userDb = validator.isEmail(loginId)
      ? await UserSchema.findOne({ email: loginId })
      : await UserSchema.findOne({ username: loginId });

    if (!userDb) {
      return res.status(401).json({ message: "User not found, please register first" });
    }

    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) {
      return res.status(403).json({ message: "Incorrect password" });
    }

    req.session.isAuth = true;
    req.session.user = {
      username: userDb.username,
      email: userDb.email,
      userId: userDb._id
    };

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Error logging in user:", err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

app.get("/dashboard", isAuth, (req, res) => {
  return res.render("dashboard");
});

app.post("/logout", isAuth, rateLimiting, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error logging out:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
    return res.redirect("/login");
  });
});

app.post("/logout_from_all_devices", isAuth, rateLimiting, async (req, res) => {
  const username = req.session.user.username;

  try {
    await store.sessionStore.collection("sessions").deleteMany({ "session.user.username": username });
    console.log("Logged out from all devices.");
    return res.json({ message: "Logged out from all devices successfully." });
  } catch (error) {
    console.error("Error logging out from all devices:", error);
    return res.status(500).json({ message: "Failed to log out from all devices.", error: error.message });
  }
});

app.post("/create-item", isAuth, rateLimiting, async (req, res) => {
  const todoText = req.body.todo;

  if (!todoText || typeof todoText !== "string" || todoText.length > 100) {
    return res.status(400).json({ message: "Invalid todo text" });
  }

  try {
    const todo = new TodoModel({ todo: todoText, username: req.session.user.username });
    const todoDb = await todo.save();
    return res.status(201).json({ message: "Data inserted successfully", data: todoDb });
  } catch (err) {
    console.error("Error creating todo item:", err);
    return res.status(500).json({ message: "Database error, please try again", error: err.message });
  }
});

app.post("/edit-item", isAuth, rateLimiting, async (req, res) => {
  const { id, newData } = req.body;

  if (!id || !newData || typeof newData !== "string" || newData.length > 100) {
    return res.status(400).json({ message: "Invalid parameters" });
  }

  try {
    const todoDb = await TodoModel.findOneAndUpdate({ _id: id }, { todo: newData }, { new: true });
    if (!todoDb) {
      return res.status(404).json({ message: "Todo not found" });
    }
    return res.json({ message: "Todo updated successfully", data: todoDb });
  } catch (err) {
    console.error("Error updating todo item:", err);
    return res.status(500).json({ message: "Database error, please try again", error: err.message });
  }
});

app.post("/delete-item", isAuth, rateLimiting, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  try {
    const todoDb = await TodoModel.findOneAndDelete({ _id: id });
    return res.json({ message: "Todo deleted successfully", data: todoDb });
  } catch (err) {
    console.error("Error deleting todo item:", err);
    return res.status(500).json({ message: "Database error, please try again", error: err.message });
  }
});

app.post("/pagination_dashboard", isAuth, async (req, res) => {
  const skip = parseInt(req.query.skip) || 0;
  const LIMIT = 5;
  const username = req.session.user.username;

  try {
    const todos = await TodoModel.aggregate([
      { $match: { username } },
      { $facet: { data: [{ $skip: skip }, { $limit: LIMIT }] } }
    ]);
    return res.json({ message: "Read successful", data: todos });
  } catch (err) {
    console.error("Error fetching todos:", err);
    return res.status(400).json({ message: "Database error, please try again later", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});
