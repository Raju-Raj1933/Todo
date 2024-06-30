const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose"); 
const {cleanUpAndValidate} = require("./utils/AuthUtils");
const UserSchema = require("./UserSchema");
const validator = require('validator');
const session = require("express-session");
const isAuth = require("./utils/middleware");
const TodoModel = require("./models/TodoModel");
const mongoDBSession = require("connect-mongodb-session")(session);
const rateLimiting = require("./middleware.js/rateLimiting");


const app = express();
const PORT = process.env.PORT || 8080;
const saltround = 15;


const mongoURI = `mongodb+srv://raju123:user123@cluster0.bdlteyq.mongodb.net/`;

mongoose.set("strictQuery", false);
mongoose
  .connect(mongoURI)
  .then((res) => {
    console.log(("Connected to MongoDb!"));
  })
  .catch((err) => {
    console.log((err));
  });


app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"))

const store = new mongoDBSession({
      uri: mongoURI,
      collection: "sessions"
})

app.use(
      session({
            secret: "mongo srcetkey",
            resave: false,
            saveuninitialized:false,
            store: store,

      })
)

app.get("/", (req, res)=> {
    res.send('<h1 style="text-align:center; color:#FF0000">Welcome To My ToDo App</h1>');
})

app.get("/register", (req, res)=>{
      res.render("register");
})

app.get("/login", (req, res)=>{
      res.render("login");
})


app.post("/register", async (req, res) => {
  console.log(req.body);
  const { name, email, username, password } = req.body;
  try {
   await cleanUpAndValidate({ name, email, password, username });
  } catch (err) {
      return res.send({
            status: 400,
            message: err
      });
  }

  const hashedPassword = await bcrypt.hash(password, saltround);
  console.log(hashedPassword);

  let user = UserSchema({
       name: name,
       email: email,
       password : hashedPassword,
       username : username,
  })

  let userAvailability;

  try {
      userAvailability = await UserSchema.findOne({email});
  } catch (err) {
      return res.send({
            status: 400,
            message: "Internal server error",
            error: err
      })
  }

  if(userAvailability){
      return res.send({
            status: 400,
            message: "User already esisit"
      })
  }

  try {
      const userDb = await user.save();
      return res.send ({
            status: 201,
            message: "Register sucessfully",
            data : ({
                  name: userDb.name,
                  email: userDb.email,
                  username: userDb.username,
                  password: userDb.password,
                  _id: userDb._id
            })
      })
  } catch (err) {
      return res.send({
         status: 400,
         message: "Internal Server Error, Plaset check and try again",
         error: err
      })
  }
  
});


app.post("/login", async (req, res) => {

  const { loginId, password } = req.body;

      if (typeof loginId !== "string" || typeof password !== "string" || !loginId || !password) {
            return res.send({ 
                  status: 400,
                  message: "Internal server error" 
            });
      }

      let userDb;

      try {
            if (validator.isEmail(loginId)) {
                  userDb = await UserSchema.findOne({ email: loginId }); 
            } else {
                  userDb = await UserSchema.findOne({ username: loginId }); 
            }
            console.log(userDb);

            if (!userDb) {
                  return res.send({
                        status: 400,
                        message: "User not found, Please register first"
                  });
            }

          const isMatch = await bcrypt.compare(password, userDb.password);

            if (!isMatch) {
                  return res.send({
                        status: 400,
                        message: "Data mismatch",
                        data: req.body
                  });
            }

        req.session.isAuth = true;
         req.session.user = {
          username: userDb.username,
          email: userDb.email,
          userId: userDb._id,
    };


            return res.status(200).redirect("/dashboard");
                 

      } catch (err) {
            return res.send({
                  status: 400,
                  message: "Internal server error, please try again", 
                  error: err
            });
      }
});


app.get("/dashboard", isAuth, (req, res)=>{
      res.render("dashboard");
})



app.post("/edit-item", isAuth, rateLimiting, async (req, res) => {

  const id = req.body.id;
  const newData = req.body.newData;

  if (!id || !newData) {
    return res.send({
      status: 400,
      message: "Missing parameters",
    });
  }

  if (typeof newData !== "string") {
    return res.send({
      status: 400,
      message: "Invalid text",
    });
  }

  if (newData.length > 100) {
    return res.send({
      status: 400,
      message: "Todo is too long",
    });
  }

  try {
    const todoDb = await TodoModel.findOneAndUpdate(
      { _id: id },
      { todo: newData }
    );

    if (!todoDb) {
      return res.send({
        status: 404,
        message: "Todo Not Found",
        data: todoDb,
      });
    }

    return res.send({
      status: 200,
      message: "Todo updated Successfully",
      data: todoDb,
    });
  } catch (err) {
    return res.send({
      status: 500,
      message: "Database error, Please try again",
      error: err,
    });
  }
});

app.post("/delete-item", isAuth, rateLimiting,  async (req, res) => {
  const id = req.body.id;
  console.log(req.body);

  if (!id) {
    return res.send({
      status: 400,
      message: "Missing parameters",
    });
  }

  try {
    const todoDb = await TodoModel.findOneAndDelete({ _id: id });
    return res.send({
      status: 200,
      message: "Todo Deleted Successfully",
      data: todoDb,
    });
  } catch (err) {
    return res.send({
      status: 500,
      message: "Database error, Please try again",
      error: err,
    });
  }
});

app.post("/pagination_dashboard", isAuth, async(req, res) => {
  const skip = req.query.skip || 0;
  const LIMIT = 5;
  const username = req.session.user.username;
  console.log(skip, username);
  try{
    let todos = await TodoModel.aggregate([
      {$match : {username : username}},
      {
        $facet : {
          data: [{ $skip: parseInt(skip) }, {$limit: LIMIT}],
        },
      },
    ]);
    console.log(todos);
    return res.send({
      status: 200,
      message: "Read Successfull",
      data: todos,
    });
  } catch (err) {
        console.log(error);
    return res.send({
      status: 400,
      message: "Database Error, Please try again later",
      error: err,
    });
  }
});




// app.get("/home", isAuth, (req, res) =>{
//             return res.send({
//                   message:"Home Page"
//             })
// })



app.post("/logout", isAuth, (req, res)=>{   // rateLimiting,
     req.session.destroy((err) => {
      if(err) throw err;
      return res.redirect("/login");
     })
})



app.post("/logout_from_all_devices", isAuth,  async (req, res) => {
  const username = req.session.user.username;
  const Schema = mongoose.Schema;
 const sessionSchema = new Schema({ _id: String }, { strict: false });
  const SessionModel = mongoose.model("session", sessionSchema );

  try {
    // const Schema = mongoose.Schema;
    const sessionSchema = new Schema({ _id: String }, { strict: false });

    let SessionModel;                                     
    if (mongoose.models.session) {                       
      SessionModel = mongoose.model("session");           
    } else {
      SessionModel = mongoose.model("session", sessionSchema); 
    }                                                   

    const sessionDb = await SessionModel.deleteMany({
      "session.user.username": username,
    });

    console.log("Deleted Sessions: ", sessionDb);        

    return res.send({
      status: 200,
      message: "Logged out from all devices successfully.",
    });
  } catch (error) {
    console.error("Error logging out from all devices:", error);  
    return res.send({
      status: 400,
      message: "Logged out from all devices Unsuccessfully.",
      error: error.message,
    });
  }
});

app.post("/create-item", isAuth, rateLimiting, async (req, res)=>{
 const todoText = req.body.todo;
 console.log(todoText);
      if(!todoText){
            return res.send({
                  status: 400,
                  message: "No data, Please Insert Data First",
            });
      }

      if(typeof todoText !== "string"){
            return res.send({
      status: 400,
      message: "Invalid text",
    });
 }

      if(todoText.length > 100){
            return res.send({
                  status: 400,
                  message: "Data is to long"
            })
      }

      let todo = new TodoModel({
            todo: todoText,
            username: req.session.user.username,
      });
           console.log(todo +"up");

try{
      const todoDb = await todo.save();
      console.log(todoDb);
      return res.send({
            status: 200,
            message: "Data inserted sucessfully",
            data:todoDb,
      });
}catch (err){
      return res.send({
            status: 400,
            message:"Database error, Please try again",
            error: err,
      });
}

});


app.listen(PORT, ()=>{
      console.log("connected");
});




