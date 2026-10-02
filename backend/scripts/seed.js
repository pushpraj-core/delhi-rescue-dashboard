require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const generateTrackingId = () => 'TRK-' + Math.random().toString(36).substr(2, 9).toUpperCase();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/raksha_mumbai';

// Mumbai Wards
const WARDS = ['A', 'B', 'C', 'D', 'E', 'F/N', 'F/S', 'G/N', 'G/S', 'H/E', 'H/W', 'K/E', 'K/W', 'L', 'M/E', 'M/W', 'N', 'P/N', 'P/S', 'R/C', 'R/N', 'R/S', 'S', 'T'];

// Coordinates roughly in Mumbai
const landBoxes = [
  { minLat: 18.90, maxLat: 19.05, minLng: 72.81, maxLng: 72.84 }, // South
  { minLat: 19.05, maxLat: 19.25, minLng: 72.83, maxLng: 72.86 }, // Western Suburbs
  { minLat: 19.05, maxLat: 19.18, minLng: 72.88, maxLng: 72.94 }, // Eastern Suburbs
  { minLat: 18.98, maxLat: 19.16, minLng: 72.98, maxLng: 73.11 }  // Navi Mumbai
];

const getRandomMumbaiCoords = () => {
  const box = landBoxes[Math.floor(Math.random() * landBoxes.length)];
  return [
    box.minLng + Math.random() * (box.maxLng - box.minLng), // Lng
    box.minLat + Math.random() * (box.maxLat - box.minLat)  // Lat
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
      { name: 'System Admin', email: 'admin@iiitnr.edu.in', role: 'admin' },
      { name: 'Nodal Officer', email: 'officer@iiitnr.edu.in', role: 'officer' }
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
    
    const categories = ['Traffic Intersection Begging', 'Hazardous Labor', 'Unattended Child'];
    const statuses = ['REPORTED', 'VERIFIED', 'DISPATCHED', 'RESCUED', 'CWC_PRODUCED', 'REHAB_FOLLOWUP', 'CLOSED', 'REJECTED', 'DUPLICATE'];
    
    const tickets = [];
    for (let i = 0; i < 248; i++) {
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
          encryptedData: 'mock_ciphertext',
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
        railwayJurisdiction: Math.random() > 0.9,
        isSynthetic: true
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
