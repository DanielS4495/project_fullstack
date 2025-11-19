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
        if (analysis.habit_name) {
          // 1. חיפוש מקדים - האם ההרגל בכלל קיים?
          // אנחנו מחפשים הרגל ששייך למשתמש ומכיל את השם שה-AI זיהה
          const habitsToDelete = await prisma.habit.findMany({
            where: {
              userId: user.id,
              habitName: {
                contains: analysis.habit_name, // חיפוש חלקי (למשל "water" ימצא את "drink water")
              },
              status: 'active' // רק הרגלים פעילים
            }
          });

          if (habitsToDelete.length === 0) {
            // לא נמצא הרגל כזה - מחזירים הודעה למשתמש במקום למחוק סתם
            resultData = { 
              success: false, 
              message: `Could not find any active habit containing "${analysis.habit_name}" to delete.` 
            };
          } else {
            // נמצאו הרגלים - מבצעים מחיקה
            await prisma.habit.updateMany({
              where: {
                userId: user.id,
                habitName: { contains: analysis.habit_name }
              },
              data: { status: 'deleted' },
            });
            
            resultData = { 
              success: true, 
              message: `Successfully deleted ${habitsToDelete.length} habit(s) matching "${analysis.habit_name}"`,
              deletedHabits: habitsToDelete.map(h => h.habitName)
            };
          }
        } else {
            resultData = { success: false, message: "AI identified deletion intent but couldn't capture the habit name." };
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