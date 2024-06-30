const isAuth = (req, res, next) => {
  if (req.session && req.session.isAuth) {
    next();
  } else {
    res.redirect("/login");
  }
};

module.exports = isAuth;

 


