const Ticket = require('../models/Ticket');
const jurisdictions = require('../../../config/jurisdictions.json');
const crypto = require('crypto');

/**
 * Matches a [lng, lat] coordinate to an MMR jurisdiction using bounding box checks.
 * Returns the jurisdiction ID (e.g. "MCGM", "THANE") or null if outside all jurisdictions.
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
 * Checks if coordinates are within the MMR region at all.
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
      'LOCATION_UNRESOLVED: Coordinates are within MMR but could not be matched to a specific jurisdiction. ' +
      'This may indicate a gap in boundary data. Report has been rejected — please try again or contact support.'
    );
  }

  // 3. Validate category
  const validCategories = jurisdictions.categories;
  if (!validCategories.includes(user_category)) {
    throw new Error(`INVALID_CATEGORY: "${user_category}" is not a valid category. Valid: ${validCategories.join(', ')}`);
  }

  // 4. Time Window: Last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 5. Triage Logic Setup
  let initialStatus = 'REPORTED';
  let priority = 'Medium';
  
  if (isEmergency) {
    priority = 'Critical';
  } else {
    // Attempt ML prediction (optional, behind ML_TRIAGE_ENABLED)
    const mlEnabled = process.env.ML_TRIAGE_ENABLED === 'true';
    const mlUrl = process.env.ML_URL || 'http://localhost:8000';
    
    if (mlEnabled) {
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
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const response = await fetch(`${mlUrl}/triage/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
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
    } else {
      // Heuristic fallback when ML is not enabled
      if (confidence_score >= 80) priority = 'High';
      else if (confidence_score < 50) priority = 'Low';
    }
  }

  // 6. Find duplicate within 50 meters that is NOT closed
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
    await existingTicket.save();
    return { status: 'DUPLICATE_UPDATED', ticket: existingTicket };
  }

  // 7. No duplicate, create new Case File
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
    dHash: dHash || null,
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
  return await Ticket.find().sort({ createdAt: -1 });
};

module.exports = {
  ingestTicket,
  getJurisdictionForLocation,
  isInMMR,
  getTickets
};
