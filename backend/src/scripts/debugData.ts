import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';
import User from '../models/User';

dotenv.config();

const debugData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected to DB');

    const users = await User.find({});
    console.log('--- USERS ---');
    users.forEach(u => console.log(`${u._id} | ${u.name} | ${u.email}`));

    const orders = await Order.find({});
    console.log('\n--- ORDERS ---');
    orders.forEach(o => {
      console.log(`Order: ${o._id} | User: ${o.user} | Status: ${o.orderStatus} | Payment: ${o.paymentStatus}`);
    });

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

debugData();
