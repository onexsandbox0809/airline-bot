import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', bookingController.create);
router.get('/history', bookingController.history);
router.get('/pnr/:pnr', bookingController.getByPnr);
router.get('/:bookingId', bookingController.getByBookingId);

export default router;
