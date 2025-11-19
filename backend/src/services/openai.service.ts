import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();
export interface AIAnalysisResult {
  action: 'create' | 'update' | 'delete' | 'list';
  habit_name?: string;
  frequency_type?: string;
  frequency_times?: any;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
});

export const analyzeText = async (text: string): Promise<AIAnalysisResult> => {
  try {
    // Try using real OpenAI first
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `
            You are a helpful assistant. Output strict JSON.
            Actions: create, update, delete, list.
            Fields: action, habit_name, frequency_type, frequency_times.
          `
        },
        { role: 'user', content: text }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content');
    return JSON.parse(content) as AIAnalysisResult;

  } catch (error) {
    console.warn('⚠️  OpenAI API failed. Using SMART MOCK logic.');
    return mockAnalyze(text);
  }
};

/**
 * A smart local parser that simulates AI understanding
 */
function mockAnalyze(text: string): AIAnalysisResult {
  const lowerText = text.toLowerCase();

  // DETECT "LIST" INTENT
  // Keywords: show, list, what are, my habits
  if (
    lowerText.includes('list') || 
    lowerText.includes('show') || 
    lowerText.includes('my habits') ||
    lowerText.includes('what are')
  ) {
    return { action: 'list' };
  }

  // DETECT "DELETE" INTENT
  // Keywords: delete, remove, stop, cancel
  if (
    lowerText.includes('delete') || 
    lowerText.includes('remove') || 
    lowerText.includes('stop') || 
    lowerText.includes('cancel')
  ) {
    // Try to guess the habit name (everything after the keyword)
    const words = lowerText.split(' ');
    const deleteIndex = words.findIndex(w => ['delete', 'remove', 'stop', 'cancel'].includes(w));
    const habitName = words.slice(deleteIndex + 1).join(' ').trim();
    
    return { 
      action: 'delete', 
      habit_name: habitName || 'unknown' // fallback if no name found
    };
  }

  // DETECT "CREATE" (Default)
  // Try to extract frequency
  let frequencyType = 'daily'; // Default
  let frequencyTimes = 1;

  if (lowerText.includes('weekly') || lowerText.includes('week')) {
    frequencyType = 'weekly';
  } else if (lowerText.includes('times')) {
    frequencyType = 'times_per_day';
    // Extract number before "times" (e.g. "3 times")
    const match = lowerText.match(/(\d+)\s+times/);
    if (match) {
      frequencyTimes = parseInt(match[1]);
    }
  }

  // Clean up text to guess the habit name
  // Remove common filler words to leave just the habit
  let cleanName = lowerText
    .replace('i want to', '')
    .replace('remind me to', '')
    .replace('daily', '')
    .replace('every day', '')
    .replace(/(\d+)\s+times a day/, '')
    .trim();

  return {
    action: 'create',
    habit_name: cleanName,
    frequency_type: frequencyType,
    frequency_times: frequencyTimes
  };
}