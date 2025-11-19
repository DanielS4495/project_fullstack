import express from 'express';
import { getHabits, handlePrompt } from './controllers/habit.controller';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/prompt', handlePrompt);

app.get('/habits', getHabits);

export default app;