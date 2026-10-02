const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');
const Ticket = require('../models/Ticket');
const delhiDistricts = require('../data/delhi_districts.json');

const crypto = require('crypto');

const getDistrictForLocation = (longitude, latitude) => {
  const pt = point([longitude, latitude]);
  for (const feature of delhiDistricts.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return feature.properties.district_id;
    }
  }
  return 'UNASSIGNED';
};

const generateTrackingId = () => {
  // Generate 12-char ID using safe alphabet (no confusing chars like 0, O, I, l)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
};

/**
 * Ingests a new ticket. Checks for duplicates within 50m in the last 2 hours.
 * If duplicate, increments reportCount. Else creates new ticket.
 */
const ingestTicket = async (ticketData) => {
  const { longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency } = ticketData;

  // 1. Assign District
  const district_id = getDistrictForLocation(longitude, latitude);

  // 2. Time Window: Last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 3. Triage Logic Setup
  let initialStatus = 'REPORTED';
  let priority = 'Medium';
  
  if (isEmergency) {
    priority = 'Critical';
  } else {
    // Attempt ML prediction
    try {
      const now = new Date();
      const payload = {
        hour: now.getHours(),
        day_of_week: now.getDay(),
        month: now.getMonth() + 1,
        lat: latitude,
        lng: longitude,
        ward: district_id,
        category: user_category,
        confidence_score: confidence_score
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
      
      const response = await fetch('http://localhost:8000/triage/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Map 1-5 urgency to priority (1: Critical, 2: High, 3: Medium, 4: Low, 5: Low)
        if (data.urgency === 1) priority = 'Critical';
        else if (data.urgency === 2) priority = 'High';
        else if (data.urgency === 3) priority = 'Medium';
        else priority = 'Low';
        console.log(`[ML Triage] Success: Urgency ${data.urgency} -> ${priority}`);
      } else {
        throw new Error(`ML API returned ${response.status}`);
      }
    } catch (err) {
      console.warn(`[ML Triage] Failed or timed out. Falling back to heuristic. Error: ${err.message}`);
      if (confidence_score >= 80) priority = 'High';
      else if (confidence_score < 50) priority = 'Low';
    }
  }

  // 4. Find duplicate within 50 meters that is NOT closed
  const existingTicket = await Ticket.findOne({
    createdAt: { $gte: twoHoursAgo },
    status: { $nin: ['CLOSED', 'REJECTED'] },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: 50 // meters
      }
    }
  });

  if (existingTicket) {
    existingTicket.reportCount += 1;
    await existingTicket.save();
    return { status: 'DUPLICATE_UPDATED', ticket: existingTicket };
  }

  // 5. No duplicate, create new Case File
  const trackingId = generateTrackingId();
  
  const slaHours = {
    'Critical': 1,
    'High': 4,
    'Medium': 12,
    'Low': 24
  };
  const slaBreachAt = new Date(Date.now() + slaHours[priority] * 60 * 60 * 1000);

  const newTicket = new Ticket({
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    district_id,
    trackingId,
    encryptedPayload,
    confidence_score,
    dHash,
    user_category,
    tags: tags || [],
    isEmergency: isEmergency || false,
    status: initialStatus,
    priority,
    slaBreachAt
  });

  await newTicket.save();
  return {
    status: 'CREATED',
    ticket: newTicket
  };
};

const getTickets = async () => {
  // Sort by newest first
  return await Ticket.find().sort({ createdAt: -1 });
};

module.exports = {
  ingestTicket,
  getDistrictForLocation,
  getTickets
};
