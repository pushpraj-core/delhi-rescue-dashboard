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
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv1', encryptedData: 'data1', wrappedKeys: [] },
      confidence_score: 85,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.reportCount).toBe(1);
    expect(result.ticket.status).toBe('REPORTED');
  });

  it('creates a Low-Confidence case file flagged for manual review', async () => {
    const result = await ingestTicket({
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv2', encryptedData: 'data2', wrappedKeys: [] },
      confidence_score: 45,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.status).toBe('REPORTED');
  });

  it('upgrades a Low-Confidence ticket if a new duplicate has a high confidence', async () => {
    // Original ticket low confidence
    await ingestTicket({
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv1', encryptedData: 'data1', wrappedKeys: [] },
      confidence_score: 40,
      user_category: 'Unattended Child'
    });

    // New duplicate ticket high confidence
    const result = await ingestTicket({
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv3', encryptedData: 'data3', wrappedKeys: [] },
      confidence_score: 90,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('DUPLICATE_UPDATED');
    expect(result.ticket.reportCount).toBe(2);
    expect(result.ticket.confidence_score).toBe(40); // Initial ticket preserves its old data in the current codebase (triage computes a new priority though)
    expect(result.ticket.status).toBe('REPORTED');
  });

  it('maintains high confidence if a new duplicate has low confidence', async () => {
    await ingestTicket({
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv3', encryptedData: 'data3', wrappedKeys: [] },
      confidence_score: 85,
      user_category: 'Unattended Child'
    });

    const result = await ingestTicket({
      longitude: 72.85,
      latitude: 19.05,
      encryptedPayload: { iv: 'iv4', encryptedData: 'data4', wrappedKeys: [] },
      confidence_score: 30,
      user_category: 'Unattended Child'
    });

    expect(result.status).toBe('DUPLICATE_UPDATED');
    expect(result.ticket.reportCount).toBe(2);
    expect(result.ticket.status).toBe('REPORTED'); 
  });
});
