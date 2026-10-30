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
const { protect, preventDemoModification } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../middleware/validate');
const {
  createTradeSchema,
  updateTradeSchema,
  queryTradeSchema
} = require('../validators/tradeValidators');

router.use(protect);

router.post('/seed', preventDemoModification, seedSampleTrades);

router.route('/')
  .get(validateQuery(queryTradeSchema), getTrades)
  .post(preventDemoModification, validateBody(createTradeSchema), createTrade)
  .delete(preventDemoModification, clearAllTrades);

router.get('/export/csv', exportTradesCSV);

router.route('/:id')
  .get(getTradeById)
  .put(preventDemoModification, validateBody(updateTradeSchema), updateTrade)
  .delete(preventDemoModification, deleteTrade);

module.exports = router;
