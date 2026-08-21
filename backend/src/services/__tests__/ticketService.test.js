const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ingestTicket } = require('../ticketService');
const Ticket = require('../../models/Ticket');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Ticket.deleteMany({});
  await Ticket.createIndexes();
});

describe('Ticket Deduplication Service with Two-Tier Triage', () => {
  it('creates a High-Confidence case file', async () => {
    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_1',
      confidence_score: 85,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.reportCount).toBe(1);
    expect(result.ticket.status).toBe('Pending Verification');
  });

  it('creates a Low-Confidence case file flagged for manual review', async () => {
    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_2',
      confidence_score: 45,
      user_category: 'Traffic Intersection Begging'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.status).toBe('Low-Confidence / Manual Review Required');
  });

  it('upgrades a Low-Confidence ticket if a new duplicate has a high confidence', async () => {
    // Original ticket low confidence
    await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_1',
      confidence_score: 40,
      user_category: 'Unattended Child'
    });

    // New duplicate ticket high confidence
    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_high',
      confidence_score: 90,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('DUPLICATE_UPDATED');
    expect(result.ticket.reportCount).toBe(2);
    expect(result.ticket.confidence_score).toBe(90); // Should be upgraded
    expect(result.ticket.status).toBe('Pending Verification'); // Status should upgrade
  });

  it('maintains high confidence if a new duplicate has low confidence', async () => {
    await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_high',
      confidence_score: 85,
      user_category: 'Unattended Child'
    });

    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_low',
      confidence_score: 30,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('DUPLICATE_UPDATED');
    expect(result.ticket.reportCount).toBe(2);
    expect(result.ticket.confidence_score).toBe(85); // Stays at max
    expect(result.ticket.status).toBe('Pending Verification'); 
  });
});
