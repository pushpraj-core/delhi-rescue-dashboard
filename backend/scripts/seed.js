require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const { generateTrackingId } = require('../src/utils/idGenerator');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raksha_mumbai';

// Mumbai Wards
const WARDS = ['A', 'B', 'C', 'D', 'E', 'F/N', 'F/S', 'G/N', 'G/S', 'H/E', 'H/W', 'K/E', 'K/W', 'L', 'M/E', 'M/W', 'N', 'P/N', 'P/S', 'R/C', 'R/N', 'R/S', 'S', 'T'];

// Coordinates roughly in Mumbai
const getRandomMumbaiCoords = () => {
  const minLat = 18.9;
  const maxLat = 19.3;
  const minLng = 72.8;
  const maxLng = 73.0;
  return [
    minLng + Math.random() * (maxLng - minLng), // Lng
    minLat + Math.random() * (maxLat - minLat)  // Lat
  ];
};

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for Seeding');

    // 1. Seed Demo Officers (Admin & Officer)
    await User.deleteMany({});
    console.log('Cleared existing users.');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create([
      { username: 'admin', password: hashedPassword, role: 'admin' },
      { username: 'officer', password: hashedPassword, role: 'officer' }
    ]);
    console.log('✅ Seeded demo users (admin, officer / admin123)');

    // 2. Seed 24 Teams (1 per ward)
    await Team.deleteMany({});
    console.log('Cleared existing teams.');
    const teams = WARDS.map(ward => ({
      name: `Mumbai Rescue Unit - Ward ${ward}`,
      ward: ward,
      status: 'AVAILABLE',
      location: {
        type: 'Point',
        coordinates: getRandomMumbaiCoords()
      },
      isRailwayPolice: Math.random() > 0.8
    }));
    await Team.insertMany(teams);
    console.log(`✅ Seeded ${teams.length} teams`);

    // 3. Seed 400+ Synthetic Tickets
    await Ticket.deleteMany({});
    console.log('Cleared existing tickets.');
    
    const categories = ['Child Labour', 'Begging', 'Lost Child', 'Trafficking', 'Abuse'];
    const statuses = ['REPORTED', 'VERIFIED', 'DISPATCHED', 'RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED', 'REJECTED', 'DUPLICATE'];
    
    const tickets = [];
    for (let i = 0; i < 450; i++) {
      const priority = ['Critical', 'High', 'Medium', 'Low'][Math.floor(Math.random() * 4)];
      
      const slaHours = { 'Critical': 1, 'High': 4, 'Medium': 12, 'Low': 24 };
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Past 7 days
      const slaBreachAt = new Date(createdAt.getTime() + slaHours[priority] * 60 * 60 * 1000);
      
      tickets.push({
        trackingId: generateTrackingId(),
        district_id: 'Mumbai',
        location: {
          type: 'Point',
          coordinates: getRandomMumbaiCoords()
        },
        encryptedPayload: {
          iv: 'mock_iv',
          ciphertext: 'mock_ciphertext',
          wrappedKeys: []
        },
        confidence_score: Math.floor(Math.random() * 100),
        user_category: categories[Math.floor(Math.random() * categories.length)],
        isEmergency: Math.random() > 0.8,
        priority,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createdAt,
        slaBreachAt,
        escalated: Date.now() > slaBreachAt.getTime() && Math.random() > 0.5,
        railwayJurisdiction: Math.random() > 0.9
      });
    }

    await Ticket.insertMany(tickets);
    console.log(`✅ Seeded ${tickets.length} synthetic tickets`);

    console.log('🎉 Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

runSeed();
