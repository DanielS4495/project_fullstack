import { handlePrompt } from '../../src/controllers/habit.controller';
import { analyzeText } from '../../src/services/openai.service';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

// 1. Mock dependencies [cite: 91]
jest.mock('../../src/services/openai.service');
jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    habit: { create: jest.fn(), findMany: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('Unit Test: Habit Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { body: {} };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
  });

  // Requirement: Validation of inputs 
  it('should return 400 if text or phoneNumber is missing', async () => {
    req.body = { text: 'Only text here' }; // Missing phoneNumber

    await handlePrompt(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing text or phoneNumber' });
  });

  // Requirement: Check if parsing works (Mocked Service) [cite: 93]
  it('should call analyzeText and return success', async () => {
    req.body = { text: 'Drink water', phoneNumber: '123' };
    
    // Mocking the DB user finding logic
    const prisma = new PrismaClient();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    
    // Mocking the AI service response
    (analyzeText as jest.Mock).mockResolvedValue({ 
        action: 'create', 
        habit_name: 'water', 
        frequency_type: 'daily' 
    });

    await handlePrompt(req as Request, res as Response);

    expect(analyzeText).toHaveBeenCalledWith('Drink water');
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        action: 'create'
    }));
  });
});