require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../src/models/User');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const jurisdictions = require('../../config/jurisdictions.json');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/raksha_mumbai';

// Deterministic seeded PRNG (Mulberry32) — NOT used in production logic, only for reproducible seed data
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const seededRng = mulberry32(42); // Fixed seed for reproducibility

const generateTrackingId = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'RKS-';
  for (let i = 0; i < 8; i++) {
    id += alphabet[crypto.randomInt(alphabet.length)];
  }
  return id;
};

// Build coordinate boxes per jurisdiction from config
const jurisdictionBoxes = jurisdictions.jurisdictions.map(j => ({
  id: j.id,
  name: j.name,
  wards: j.wards || [],
  latMin: j.bounds.latMin,
  latMax: j.bounds.latMax,
  lngMin: j.bounds.lngMin,
  lngMax: j.bounds.lngMax
}));

const getCoordInJurisdiction = (jur) => {
  return [
    jur.lngMin + seededRng() * (jur.lngMax - jur.lngMin),
    jur.latMin + seededRng() * (jur.latMax - jur.latMin)
  ];
};

const categories = jurisdictions.categories;
const VALID_STATUSES = ['REPORTED', 'DISPATCHED', 'RESCUED', 'CLOSED', 'REJECTED'];
const priorities = ['Critical', 'High', 'Medium', 'Low'];

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for Seeding');

    // 1. Seed Demo Officers
    await User.deleteMany({});
    console.log('Cleared existing users.');
    await User.create([
      { name: 'System Admin', email: 'admin@raksha.dev', role: 'admin' },
      { name: 'Mumbai Officer', email: 'officer.mcgm@raksha.dev', role: 'officer' },
      { name: 'Thane Officer', email: 'officer.thane@raksha.dev', role: 'officer' },
      { name: 'Navi Mumbai Officer', email: 'officer.navimumbai@raksha.dev', role: 'officer' }
    ]);
    console.log('✅ Seeded demo users');

    // 2. Seed Teams (one per MCGM ward + one per other jurisdiction)
    await Team.deleteMany({});
    console.log('Cleared existing teams.');
    const teams = [];

    // MCGM wards
    const mcgm = jurisdictionBoxes.find(j => j.id === 'MCGM');
    if (mcgm && mcgm.wards.length > 0) {
      for (const ward of mcgm.wards) {
        teams.push({
          name: `Mumbai Rescue Unit - Ward ${ward}`,
          ward: ward,
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: getCoordInJurisdiction(mcgm) },
          isRailwayPolice: false
        });
      }
    }

    // One team per non-MCGM jurisdiction
    for (const jur of jurisdictionBoxes) {
      if (jur.id === 'MCGM') continue;
      teams.push({
        name: `${jur.name} Rescue Unit`,
        ward: jur.id,
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: getCoordInJurisdiction(jur) },
        isRailwayPolice: false
      });
    }

    // Railway police teams for major stations
    const railwayStations = ['CSMT', 'Dadar', 'Kurla', 'Thane', 'Kalyan'];
    for (const station of railwayStations) {
      teams.push({
        name: `GRP Unit - ${station}`,
        ward: 'GRP',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: getCoordInJurisdiction(mcgm || jurisdictionBoxes[0]) },
        isRailwayPolice: true
      });
    }

    await Team.insertMany(teams);
    console.log(`✅ Seeded ${teams.length} teams`);

    // 3. Seed 420 Synthetic Tickets spread across jurisdictions
    await Ticket.deleteMany({});
    console.log('Cleared existing tickets.');

    const tickets = [];
    const TOTAL_TICKETS = 420;

    // Distribute: ~55% MCGM, ~10% each for Thane/Navi Mumbai, ~5% each for rest
    const distribution = [
      { jur: 'MCGM', count: 230 },
      { jur: 'THANE', count: 45 },
      { jur: 'NAVI_MUMBAI', count: 45 },
      { jur: 'KALYAN_DOMBIVLI', count: 30 },
      { jur: 'MIRA_BHAYANDAR', count: 25 },
      { jur: 'VASAI_VIRAR', count: 25 },
      { jur: 'PANVEL', count: 20 }
    ];

    for (const { jur: jurId, count } of distribution) {
      const jurBox = jurisdictionBoxes.find(j => j.id === jurId);
      if (!jurBox) continue;

      for (let i = 0; i < count; i++) {
        const priorityIdx = Math.floor(seededRng() * priorities.length);
        const priority = priorities[priorityIdx];
        const categoryIdx = Math.floor(seededRng() * categories.length);

        const slaHours = { 'Critical': 1, 'High': 4, 'Medium': 12, 'Low': 24 };
        // Spread across last 14 days for better time-series data
        const daysAgo = seededRng() * 14;
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const slaBreachAt = new Date(createdAt.getTime() + slaHours[priority] * 60 * 60 * 1000);

        // Status should be consistent with age: older tickets more likely closed
        let status;
        if (daysAgo > 10) {
          status = seededRng() > 0.2 ? 'CLOSED' : 'RESCUED';
        } else if (daysAgo > 5) {
          const r = seededRng();
          if (r < 0.3) status = 'CLOSED';
          else if (r < 0.6) status = 'RESCUED';
          else status = 'DISPATCHED';
        } else if (daysAgo > 2) {
          const r = seededRng();
          if (r < 0.2) status = 'RESCUED';
          else if (r < 0.5) status = 'DISPATCHED';
          else status = 'REPORTED';
        } else {
          status = seededRng() > 0.3 ? 'REPORTED' : 'DISPATCHED';
        }

        const coords = getCoordInJurisdiction(jurBox);

        // Assign to a MCGM ward if jurisdiction is MCGM
        let wardId = jurId;
        if (jurId === 'MCGM' && jurBox.wards.length > 0) {
          const wardIdx = Math.floor(seededRng() * jurBox.wards.length);
          wardId = `MCGM-${jurBox.wards[wardIdx]}`;
        }

        tickets.push({
          trackingId: generateTrackingId(),
          district_id: jurId,
          location: {
            type: 'Point',
            coordinates: coords
          },
          encryptedPayload: {
            iv: 'seed_placeholder_iv',
            encryptedData: 'seed_placeholder_ciphertext',
            wrappedKeys: [
              { officerEmail: 'officer.mcgm@raksha.dev', wrappedKey: 'seed_placeholder_key' }
            ]
          },
          confidence_score: Math.floor(seededRng() * 60) + 40, // 40-99
          user_category: categories[categoryIdx],
          isEmergency: priority === 'Critical' && seededRng() > 0.5,
          priority,
          status,
          createdAt,
          slaBreachAt,
          escalated: Date.now() > slaBreachAt.getTime(),
          railwayJurisdiction: seededRng() > 0.92,
          isSynthetic: true
        });
      }
    }

    await Ticket.insertMany(tickets);
    console.log(`✅ Seeded ${tickets.length} synthetic tickets across ${distribution.length} MMR jurisdictions`);

    // Summary
    const jurCounts = {};
    for (const t of tickets) {
      jurCounts[t.district_id] = (jurCounts[t.district_id] || 0) + 1;
    }
    console.log('Distribution:', jurCounts);

    console.log('🎉 Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

runSeed();
