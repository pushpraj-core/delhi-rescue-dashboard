const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Ticket = require('../src/models/Ticket');
const Team = require('../src/models/Team');
const { ingestTicket } = require('../src/services/ticketService');
const notificationService = require('../src/services/notificationService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Ticket.deleteMany({});
  await Team.deleteMany({});
});

describe('Tier 2 Operations', () => {
  test('SLA Calculation on Ingestion', async () => {
    const payload = {
      longitude: 72.85,
      latitude: 19.0,
      encryptedPayload: { wrappedKeys: [] },
      confidence_score: 85,
      user_category: 'Child Labour',
      isEmergency: true
    };
    
    const result = await ingestTicket(payload);
    expect(result.status).toBe('CREATED');
    expect(result.ticket.priority).toBe('Critical');
    
    // SLA for Critical should be 1 hour
    const diff = result.ticket.slaBreachAt.getTime() - result.ticket.createdAt.getTime();
    expect(diff).toBe(60 * 60 * 1000);
  });

  test('Team Suggestion Logic (Nearest)', async () => {
    await Team.create([
      { name: 'Team Far', ward: 'A', location: { type: 'Point', coordinates: [72.1, 19.1] } },
      { name: 'Team Near', ward: 'B', location: { type: 'Point', coordinates: [72.8, 19.0] } } // Closer
    ]);

    const nearTeams = await Team.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [72.85, 19.0] }
        }
      }
    });

    expect(nearTeams[0].name).toBe('Team Near');
  });
});
