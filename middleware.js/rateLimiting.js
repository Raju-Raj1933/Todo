const AccessModel = require("../models/AccessModel.js");

const rateLimiting = async (req, res, next) => {
  const sessionId = req.session.id;

  console.log(sessionId);

  if (!sessionId) {
    return res.send({
      status: 400,
      message: "Invalid Session. Please login.",
    });
  }

  const sessionDb = await AccessModel.findOne({ sessionId: sessionId });

  console.log(sessionDb);
  if (!sessionDb) {

    const accessTime = new AccessModel({
      sessionId: sessionId,
      time: Date.now(),
    });

    await accessTime.save();
    next();
    return;
  }


  const previousAccessTime = sessionDb.time;
  const currentTime = Date.now();

  console.log((currentTime - previousAccessTime) / (1000 * 60));

  if (currentTime - previousAccessTime < 2000) {
    return res.send({
      status: 401,
      message: "Too many request, Please try in some time.",
    });
  }


  try {
    await AccessModel.findOneAndUpdate(
      { sessionId: sessionId },
      { time: Date.now() }
    );
    next();
  } catch (error) {
    return res.send({
      status: 400,
      message: "database error",
      error: error,
    });
  }
};

module.exports = rateLimiting;