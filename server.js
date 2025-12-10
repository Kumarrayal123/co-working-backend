


require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const cabinRoutes = require("./routes/cabins");
const adminRoutes = require("./routes/admin");
const bookingRoutes = require("./routes/bookings");
const alluserRoutes = require("./routes/auth");


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cabins", cabinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/allusers", alluserRoutes);


// DB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.log("DB Error:", err));

// Start Server
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://0.0.0.0:${process.env.PORT}`);
});

