const express = require('express');
const router = express.Router();
const {
  getTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade,
  clearAllTrades,
  exportTradesCSV,
  seedSampleTrades
} = require('../controllers/tradeController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/seed', seedSampleTrades);

router.route('/')
  .get(getTrades)
  .post(createTrade)
  .delete(clearAllTrades);

router.get('/export/csv', exportTradesCSV);

router.route('/:id')
  .get(getTradeById)
  .put(updateTrade)
  .delete(deleteTrade);

module.exports = router;
