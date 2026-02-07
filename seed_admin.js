require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./model/Admin');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        const email = 'admin@timely.com';
        const password = 'admin'; // Simple password for testing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if admin exists
        let admin = await Admin.findOne({ email });

        if (admin) {
            console.log('Admin already exists. Updating password...');
            admin.password = hashedPassword;
            await admin.save();
        } else {
            console.log('Creating new admin...');
            admin = new Admin({
                name: 'Super Admin',
                email,
                password: hashedPassword
            });
            await admin.save();
        }

        console.log('Admin Setup Complete!');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err);
        process.exit(1);
    }
};

createAdmin();
