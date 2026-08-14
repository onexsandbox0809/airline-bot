import { Router } from 'express';
import { flightController } from '../controllers/flight.controller';

const router = Router();

router.post('/search', flightController.search);
router.get('/:id', flightController.getById);

export default router;
