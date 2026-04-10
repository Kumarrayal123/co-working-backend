require('dotenv').config();
const mongoose = require('mongoose');
const Cabin = require('./model/cabin');

const checkCabins = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        const cabins = await Cabin.find().populate('owner', 'email name');
        console.log('--- CABINS IN DATABASE ---');
        cabins.forEach(c => {
            console.log(`ID: ${c._id}`);
            console.log(`Name: ${c.name}`);
            console.log(`Owner Email: ${c.owner?.email || 'N/A'}`);
            console.log(`Owner ID: ${c.owner?._id || c.owner || 'N/A'}`);
            console.log('--------------------------');
        });

        if (cabins.length === 0) {
            console.log('No cabins found in database.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

checkCabins();
