import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuthenticate, chatController.chat);

export default router;
