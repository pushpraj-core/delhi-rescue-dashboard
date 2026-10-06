const Ticket = require('../models/Ticket');
const jurisdictions = require('../../../config/jurisdictions.json');
const crypto = require('crypto');
const { computeTriage } = require('./triageService');

/**
 * Matches a [lng, lat] coordinate to an MMR jurisdiction using bounding box checks.
 */
const getJurisdictionForLocation = (longitude, latitude) => {
  for (const jur of jurisdictions.jurisdictions) {
    if (
      latitude >= jur.bounds.latMin &&
      latitude <= jur.bounds.latMax &&
      longitude >= jur.bounds.lngMin &&
      longitude <= jur.bounds.lngMax
    ) {
      return jur.id;
    }
  }
  return null;
};

/**
 * Checks if coordinates are within the MMR region.
 */
const isInMMR = (longitude, latitude) => {
  const b = jurisdictions.region.bounds;
  return (
    latitude >= b.latMin &&
    latitude <= b.latMax &&
    longitude >= b.lngMin &&
    longitude <= b.lngMax
  );
};

const generateTrackingId = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'RKS-';
  for (let i = 0; i < 8; i++) {
    id += alphabet[crypto.randomInt(alphabet.length)];
  }
  return id;
};

/**
 * Ingests a new ticket. Checks for duplicates within 50m in the last 2 hours.
 * If duplicate, increments reportCount. Else creates new ticket.
 */
const ingestTicket = async (ticketData) => {
  const { longitude, latitude, encryptedPayload, confidence_score, user_category, tags, isEmergency, dHash } = ticketData;

  // 1. Validate location is within MMR
  if (!isInMMR(longitude, latitude)) {
    throw new Error('LOCATION_OUT_OF_REGION: Coordinates are outside the Mumbai Metropolitan Region.');
  }

  // 2. Assign Jurisdiction
  const district_id = getJurisdictionForLocation(longitude, latitude);
  if (!district_id) {
    throw new Error(
      'LOCATION_UNRESOLVED: Coordinates are within MMR but could not be matched to a specific jurisdiction.'
    );
  }

  // 3. Validate category
  const validCategories = jurisdictions.categories;
  if (!validCategories.includes(user_category)) {
    throw new Error(`INVALID_CATEGORY: "${user_category}" is not a valid category.`);
  }

  // 4. Time Window: Last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 5. Find duplicate within 50 meters that is NOT closed
  const existingTicket = await Ticket.findOne({
    createdAt: { $gte: twoHoursAgo },
    status: { $nin: ['CLOSED', 'REJECTED'] },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: 50
      }
    }
  });

  if (existingTicket) {
    existingTicket.reportCount += 1;

    // Re-triage with updated reportCount
    const triage = computeTriage({
      isEmergency: existingTicket.isEmergency || isEmergency,
      category: existingTicket.user_category,
      hour: new Date().getHours(),
      reportCount: existingTicket.reportCount,
      latitude,
      longitude,
      confidenceScore: confidence_score
    });

    // Escalate priority if triage says higher
    const priorityRank = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    if (priorityRank[triage.priority] > priorityRank[existingTicket.priority]) {
      existingTicket.priority = triage.priority;
      existingTicket.triageReasons = triage.reasons;
      existingTicket.triageScore = triage.score;
    }

    await existingTicket.save();
    return { status: 'DUPLICATE_UPDATED', ticket: existingTicket };
  }

  // 6. Triage: transparent rule-based priority
  const now = new Date();
  const triage = computeTriage({
    isEmergency,
    category: user_category,
    hour: now.getHours(),
    reportCount: 1,
    latitude,
    longitude,
    confidenceScore: confidence_score
  });

  // 7. Create new Case File
  const trackingId = generateTrackingId();

  const slaHours = { 'Critical': 1, 'High': 4, 'Medium': 12, 'Low': 24 };
  const slaBreachAt = new Date(Date.now() + slaHours[triage.priority] * 60 * 60 * 1000);

  // Check railway proximity for GRP/RPF flagging
  const { nearestStation } = require('./triageService');
  const stationCheck = nearestStation(latitude, longitude);

  const newTicket = new Ticket({
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    district_id,
    trackingId,
    encryptedPayload,
    confidence_score,
    dHash: dHash || null,
    user_category,
    tags: tags || [],
    isEmergency: isEmergency || false,
    status: 'REPORTED',
    priority: triage.priority,
    triageScore: triage.score,
    triageReasons: triage.reasons,
    railwayJurisdiction: !!stationCheck,
    slaBreachAt
  });

  await newTicket.save();
  return {
    status: 'CREATED',
    ticket: newTicket
  };
};

const getTickets = async () => {
  return await Ticket.find().sort({ createdAt: -1 });
};

module.exports = {
  ingestTicket,
  getJurisdictionForLocation,
  isInMMR,
  getTickets
};
