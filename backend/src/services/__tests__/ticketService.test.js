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
  // Explicitly ensure indexes are created in memory server for geo queries to work
  await Ticket.createIndexes();
});

describe('Ticket Deduplication Service', () => {
  it('creates a new case file when no nearby tickets exist', async () => {
    // Connaught Place: [77.2177, 28.6304]
    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_1'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.reportCount).toBe(1);
    expect(result.ticket.district_id).not.toBe('UNASSIGNED'); // Should assign district

    const count = await Ticket.countDocuments();
    expect(count).toBe(1);
  });

  it('updates an existing case file if a ticket exists within 50m and 2 hours', async () => {
    // Original ticket at Connaught Place
    await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_1'
    });

    // Second ticket very close (approx 10-20 meters away) within time window
    const result = await ingestTicket({
      longitude: 77.2178, // slight shift
      latitude: 28.6305,
      imageReference: 'secure_hash_2'
    });

    expect(result.status).toBe('DUPLICATE_UPDATED');
    expect(result.ticket.reportCount).toBe(2); // Count should increment

    // Ensure no new document was created
    const count = await Ticket.countDocuments();
    expect(count).toBe(1);
  });

  it('creates a new case file if ticket is within 50m but OLDER than 2 hours', async () => {
    // Manually create an old ticket
    const oldTicket = new Ticket({
      location: { type: 'Point', coordinates: [77.2177, 28.6304] },
      imageReference: 'secure_hash_old',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    });
    await oldTicket.save();

    // New ticket at same location
    const result = await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_new'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.reportCount).toBe(1);

    // Should have 2 docs now
    const count = await Ticket.countDocuments();
    expect(count).toBe(2);
  });

  it('creates a new case file if ticket is recent but further than 50m', async () => {
    await ingestTicket({
      longitude: 77.2177,
      latitude: 28.6304,
      imageReference: 'secure_hash_1'
    });

    // Point > 50m away (e.g., 200m away)
    const result = await ingestTicket({
      longitude: 77.2200, 
      latitude: 28.6304,
      imageReference: 'secure_hash_2'
    });

    expect(result.status).toBe('CREATED');
    expect(result.ticket.reportCount).toBe(1);

    const count = await Ticket.countDocuments();
    expect(count).toBe(2);
  });
});
