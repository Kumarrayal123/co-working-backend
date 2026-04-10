require('dotenv').config();
const mongoose = require('mongoose');
const Cabin = require('./model/cabin');

// The ID for saidulureddy@gmail.com found in logs
const TARGET_USER_ID = "68ebe9ee8f06d33ee022d665";

const reassign = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        const result = await Cabin.updateMany({}, { $set: { owner: TARGET_USER_ID } });
        console.log(`Successfully reassigned ${result.modifiedCount} cabins to user ${TARGET_USER_ID}`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

reassign();
