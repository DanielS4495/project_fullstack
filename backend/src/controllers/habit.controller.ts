import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { analyzeText } from '../services/openai.service';

const prisma = new PrismaClient();

export const handlePrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, phoneNumber } = req.body;

    if (!text || !phoneNumber) {
      res.status(400).json({ error: 'Missing text or phoneNumber' });
      return;
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      user = await prisma.user.create({ data: { phoneNumber } });
    }

    // obtain analysis from OpenAI
    const analysis = await analyzeText(text);
    console.log('Analysis result:', analysis);

    let resultData = null;

    //the results based on action
    switch (analysis.action) {
      case 'create':
        if (analysis.habit_name && analysis.frequency_type) {
          resultData = await prisma.habit.create({
            data: {
              userId: user.id,
              habitName: analysis.habit_name,
              frequencyType: analysis.frequency_type,
              frequencyTimes: JSON.stringify(analysis.frequency_times || ''),
            },
          });
        }
        break;

      case 'list':
        resultData = await prisma.habit.findMany({
          where: { userId: user.id, status: 'active' },
        });
        break;

      case 'delete':
    //delete case
      if (analysis.habit_name) {
          await prisma.habit.updateMany({
            where: { 
                userId: user.id, 
                habitName: { contains: analysis.habit_name } 
            },
            data: { status: 'deleted' },
          });
          resultData = { message: `Deleted habits matching "${analysis.habit_name}"` };
        }
        break;
        
    }

    res.json({
      action: analysis.action,
      result: resultData,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
  
};
export const getHabits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ error: 'Missing or invalid phoneNumber' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: { habits: true } 
    });

    if (!user) {
      res.json([]); // Return empty list if user not found
      return;
    }

    res.json(user.habits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};