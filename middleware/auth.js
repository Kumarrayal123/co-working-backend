const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const fs = require("fs");

module.exports = async function (req, res, next) {
    console.log("====================================");
    console.log("🔥 AUTH MIDDLEWARE HIT 🔥");

    const authHeader = req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    console.log("🔍 Token present:", !!token);
    console.log("🔍 Auth header:", authHeader ? authHeader.substring(0, 20) + "..." : "none");

    let user = null;

    if (token) {
        try {
            // Try to verify with JWT first
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || "super_secret_key");
                user = decoded;
                console.log("✅ JWT Verification successful");
            } catch (jwtErr) {
                console.log("⚠️ JWT verification failed, trying decode:", jwtErr.message);
                // Fallback to decode for development
                const decoded = jwt.decode(token);
                if (decoded) {
                    user = decoded;
                    console.log("✅ JWT decode successful (fallback)");
                }
            }

            if (user) {
                console.log("-----------------------------------------");
                console.log("🔍 AUTH DECODED:", JSON.stringify(user, null, 2));
                console.log("-----------------------------------------");
                fs.appendFileSync("auth_debug.log", `[${new Date().toISOString()}] DECODED: ${JSON.stringify(user, null, 2)}\n\n`);
            }
        } catch (err) {
            console.error("❌ Auth Decode Error:", err.message);
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    }

    if (user) {
        req.user = user;
        // Aggressive resolution of ID from all possible fields
        const resolvedId =
            user.userId || user.id || user._id ||
            (user.admin && (user.admin.id || user.admin._id)) ||
            (user.user && (user.user.id || user.user._id)) ||
            user.sub;

        req.user.id = resolvedId;

        // 🔥 FORCE USER ID AS REQUESTED 🔥
        const email = (user.email || (user.admin && user.admin.email) || "").toLowerCase();
        if (email.includes("saidulureddy")) {
            const forcedId = "68ebe9ee8f06d33ee022d665";
            console.log(`🌟 FORCING ID: ${forcedId} for ${email}`);
            req.user.id = forcedId;
        }

        console.log(`🔍 Auth: Decoded Email: ${user.email || user.admin?.email || "N/A"}`);
        console.log(`🔍 Auth: Resolved ID: ${req.user.id}`);
    }

    // FINAL FALLBACK - Only for development, remove in production
    if (!req.user || !req.user.id) {
        console.warn("⚠️ Auth: No ID found in token. Returning 401.");
        return res.status(401).json({ message: "Authentication failed - no user ID found" });
    }

    console.log("✅ Auth middleware passed");
    next();
};
