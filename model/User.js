// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     mobile: { type: String, required: true },
//     address: { type: String, required: true },
// });

// module.exports = mongoose.model("User", userSchema);


const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, required: true },
    address: { type: String, required: true },

    // Doctor Verification Documents
    adharCard: { type: String, required: true },          // file/url
    panCard: { type: String, required: true },            // file/url
    mbbsCertificate: { type: String, required: true },    // file/url
    pmcRegistration: { type: String, required: true },    // Permanent Medical Registration
    nmrId: { type: String, required: true },              // National Medical Register ID

    // Verification Status
    status: { 
        type: String, 
        enum: ["pending", "approved", "rejected"], 
        default: "pending" 
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
