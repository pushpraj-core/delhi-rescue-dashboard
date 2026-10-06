const jurisdictions = require('../../../config/jurisdictions.json');

/**
 * Transparent rule-based triage service.
 * 
 * Inputs: isEmergency, category, hour, reportCount, railwayProximity, confidenceScore
 * Output: { priority, score, reasons[] }
 * 
 * Every rule is documented. The reasons array is stored on the ticket
 * and shown in the dashboard beside the priority badge.
 */

// Railway stations from config for proximity checks
const ALL_STATIONS = [];
for (const jur of jurisdictions.jurisdictions) {
  if (jur.stations) {
    for (const station of jur.stations) {
      ALL_STATIONS.push({
        name: station.name,
        lat: station.lat,
        lng: station.lng,
        line: station.line,
        grp: station.grp
      });
    }
  }
}

/**
 * Haversine distance in metres between two [lat, lng] points.
 */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if coordinates are near a railway station (within thresholdMetres).
 */
function nearestStation(lat, lng, thresholdMetres = 500) {
  let nearest = null;
  let minDist = Infinity;

  for (const station of ALL_STATIONS) {
    const dist = haversineM(lat, lng, station.lat, station.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }

  if (nearest && minDist <= thresholdMetres) {
    return { station: nearest, distance: Math.round(minDist) };
  }
  return null;
}

// High-risk categories
const HIGH_RISK_CATEGORIES = ['Trafficking Suspicion', 'Abuse / Violence', 'Missing Child Sighted'];
const MEDIUM_RISK_CATEGORIES = ['Child Labour', 'Begging (Organized)'];

// Peak hours (when children are most vulnerable)
const PEAK_HOURS_NIGHT = [22, 23, 0, 1, 2, 3, 4, 5];  // 10 PM - 5 AM
const PEAK_HOURS_COMMUTE = [7, 8, 9, 17, 18, 19]; // Morning and evening rush

/**
 * Compute triage priority with transparent, auditable reasons.
 * 
 * @param {Object} params
 * @param {boolean} params.isEmergency - Citizen marked as immediate danger
 * @param {string} params.category - Report category
 * @param {number} params.hour - Hour of day (0-23)
 * @param {number} params.reportCount - Number of reports at this location in the time window
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} params.confidenceScore - Scene confidence score (0-100)
 * @returns {{ priority: string, score: number, reasons: string[] }}
 */
function computeTriage({ isEmergency, category, hour, reportCount, latitude, longitude, confidenceScore }) {
  let score = 0;
  const reasons = [];

  // Rule 1: Emergency flag (citizen pressed the "In Danger" button)
  if (isEmergency) {
    score += 50;
    reasons.push('Emergency flag set by reporter');
  }

  // Rule 2: High-risk category
  if (HIGH_RISK_CATEGORIES.includes(category)) {
    score += 25;
    reasons.push(`High-risk category: ${category}`);
  } else if (MEDIUM_RISK_CATEGORIES.includes(category)) {
    score += 15;
    reasons.push(`Medium-risk category: ${category}`);
  }

  // Rule 3: Night-time report
  if (PEAK_HOURS_NIGHT.includes(hour)) {
    score += 15;
    reasons.push(`Night-time report (${hour}:00)`);
  } else if (PEAK_HOURS_COMMUTE.includes(hour)) {
    score += 5;
    reasons.push(`Commute-hour report (${hour}:00)`);
  }

  // Rule 4: Multiple reports (corroboration)
  if (reportCount >= 3) {
    score += 20;
    reasons.push(`${reportCount} reports at this location in 2h (strong corroboration)`);
  } else if (reportCount >= 2) {
    score += 10;
    reasons.push(`${reportCount} reports at this location in 2h (corroboration)`);
  }

  // Rule 5: Railway/station proximity
  const stationCheck = nearestStation(latitude, longitude);
  if (stationCheck) {
    score += 10;
    reasons.push(`Near railway station: ${stationCheck.station.name} (${stationCheck.distance}m, ${stationCheck.station.line} line)`);
  }

  // Rule 6: High confidence score
  if (confidenceScore >= 85) {
    score += 10;
    reasons.push(`High scene confidence: ${confidenceScore}%`);
  } else if (confidenceScore < 40) {
    score -= 5;
    reasons.push(`Low scene confidence: ${confidenceScore}%`);
  }

  // Map score to priority
  let priority;
  if (score >= 50) {
    priority = 'Critical';
  } else if (score >= 30) {
    priority = 'High';
  } else if (score >= 15) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  return { priority, score, reasons };
}

module.exports = { computeTriage, nearestStation, ALL_STATIONS };
