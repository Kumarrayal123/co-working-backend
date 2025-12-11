const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
    // Get token from header
    const token = req.header("Authorization")?.split(" ")[1];

    // Check if no token
    if (!token) {
        return res.status(401).json({ msg: "No token, authorization denied" });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Auth Middleware Decoded:", decoded);
        req.user = decoded.user || decoded;

        if (decoded.userId) {
            req.user = { id: decoded.userId };
        } else {
            req.user = decoded;
        }
        console.log("Auth Middleware req.user:", req.user);

        next();
    } catch (err) {
        res.status(401).json({ msg: "Token is not valid" });
    }
};
