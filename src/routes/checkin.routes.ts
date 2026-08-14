import { Router } from 'express';
import { checkinController } from '../controllers/checkin.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, checkinController.checkIn);

export default router;
