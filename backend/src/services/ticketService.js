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
  let initialStatus = 'New Reports';
  let priority = 'Medium';
  if (isEmergency) priority = 'Critical';
  else if (confidence_score >= 80) priority = 'High';
  else if (confidence_score < 50) priority = 'Low';

  // 4. Find duplicate within 50 meters that is NOT closed
  const existingTicket = await Ticket.findOne({
    createdAt: { $gte: twoHoursAgo },
    status: { $ne: 'Case Closed (CWC)' },
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
  
  const newTicket = new Ticket({
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    district_id,
    trackingId,
    encryptedPayload,
    confidence_score,
    user_category,
    tags: tags || [],
    isEmergency: isEmergency || false,
    status: initialStatus,
    priority
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
