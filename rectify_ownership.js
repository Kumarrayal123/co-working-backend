require('dotenv').config();
const mongoose = require('mongoose');
const Cabin = require('./model/cabin');

// The ID for saidulureddy@gmail.com
const SAIDULU_ID = "68ebe9ee8f06d33ee022d665";
// A placeholder ID for the other cabins (taken from auth logs)
const OTHER_ID = "694e55480e3e176ff1829a32";

// The 2 most recent cabins (identified from cabin_inventory.json)
const SAIDULU_CABIN_IDS = [
    "69773957ebac327b9422bbd4",
    "6953a32f98d91a36a2d497ba"
];

const rectify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        // 1. Reassign the 2 specific cabins to Saidulu
        const result1 = await Cabin.updateMany(
            { _id: { $in: SAIDULU_CABIN_IDS } },
            { $set: { owner: SAIDULU_ID } }
        );
        console.log(`Assigned ${result1.modifiedCount} cabins to ${SAIDULU_ID}`);

        // 2. Reassign the other 6 cabins to the placeholder
        const result2 = await Cabin.updateMany(
            { _id: { $nin: SAIDULU_CABIN_IDS } },
            { $set: { owner: OTHER_ID } }
        );
        console.log(`Reassigned ${result2.modifiedCount} other cabins to system ID ${OTHER_ID}`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

rectify();
