const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');
const Ticket = require('../models/Ticket');
const delhiDistricts = require('../data/delhi_districts.json');

const getDistrictForLocation = (longitude, latitude) => {
  const pt = point([longitude, latitude]);
  for (const feature of delhiDistricts.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return feature.properties.district_id;
    }
  }
  return 'UNASSIGNED';
};

/**
 * Ingests a new ticket. Checks for duplicates within 50m in the last 2 hours.
 * If duplicate, increments reportCount. Else creates new ticket.
 */
const ingestTicket = async (ticketData) => {
  const { longitude, latitude, imageReference, confidence_score, user_category } = ticketData;

  // 1. Assign District
  const district_id = getDistrictForLocation(longitude, latitude);

  // 2. Time Window: Last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // 3. Triage Logic Setup
  const initialStatus = confidence_score < 60 ? 'Low-Confidence / Manual Review Required' : 'Pending Verification';

  // 4. Find duplicate within 50 meters
  const existingTicket = await Ticket.findOne({
    createdAt: { $gte: twoHoursAgo },
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
      // If previously low confidence, but now high, upgrade status
      if (existingTicket.status === 'Low-Confidence / Manual Review Required' && confidence_score >= 60) {
        existingTicket.status = 'Pending Verification';
      }
    }

    await existingTicket.save();
    return {
      status: 'DUPLICATE_UPDATED',
      ticket: existingTicket
    };
  }

  // 5. No duplicate, create new Case File
  const newTicket = new Ticket({
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    district_id,
    imageReference,
    confidence_score,
    user_category,
    status: initialStatus
  });

  await newTicket.save();
  return {
    status: 'CREATED',
    ticket: newTicket
  };
};

module.exports = {
  ingestTicket,
  getDistrictForLocation
};
