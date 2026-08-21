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
  // Generate 6-digit alphanumeric uppercase ID
  return crypto.randomBytes(3).toString('hex').toUpperCase();
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
    // Duplicate found, increment report count
    existingTicket.reportCount += 1;
    
    // Upgrade confidence score if the new report is more confident
    if (confidence_score > existingTicket.confidence_score) {
      existingTicket.confidence_score = confidence_score;
    }
    
    // Elevate priority if the new duplicate report marks emergency
    if (isEmergency) {
      existingTicket.isEmergency = true;
    }
    
    // Merge new tags seamlessly
    if (tags && tags.length > 0) {
      const uniqueTags = new Set([...existingTicket.tags, ...tags]);
      existingTicket.tags = Array.from(uniqueTags);
    }
    
    if (isEmergency) existingTicket.isEmergency = true;

    await existingTicket.save();
    return {
      status: 'DUPLICATE_UPDATED',
      ticket: existingTicket
    };
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
    status: initialStatus
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
