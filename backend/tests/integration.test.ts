import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Integration Tests', () => {
  
  // Cleanup database before running tests
  beforeAll(async () => {
    // Connect and clear
    await prisma.$connect();
    await prisma.habit.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST /prompt - should create a new habit', async () => {
    const response = await request(app)
      .post('/prompt')
      .send({
        text: "I want to drink water 3 times a day",
        phoneNumber: "test-user-555"
      });

    // 1. Check HTTP Response
    expect(response.status).toBe(200);
    expect(response.body.action).toBe('create');
    
    // Since we use the Mock, check for the mock response name
    // (Adjust this string if your mock returns something else)
    expect(JSON.stringify(response.body)).toContain('drink water');

    const user = await prisma.user.findUnique({ where: { phoneNumber: "test-user-555" } });
    expect(user).toBeTruthy();

    if (user) {
      const habits = await prisma.habit.findMany({ where: { userId: user.id } });
      expect(habits.length).toBeGreaterThan(0);
      expect(habits[0].frequencyType).toBe('daily');
    }
  });
  it('GET /habits - should return list of habits for user', async () => {
    // First create a habit (relying on previous test or create manually)
    // Then fetch:
    const response = await request(app)
      .get('/habits?phoneNumber=test-user-555');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    // If run after the previous test, it should have at least 1 item
    if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('habitName');
    }
  });
});