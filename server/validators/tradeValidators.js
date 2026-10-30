const { z } = require('zod');

const createTradeSchema = z.object({
  tradeName: z.string().trim().min(1, 'Trade Name is required').max(100),
  date: z.string().trim().min(4, 'Trade date is required'),
  time: z.string().trim().optional(),
  instrument: z.string().trim().min(2, 'Instrument is required').max(30),
  session: z.string().trim().optional(),
  setupRating: z.string().trim().optional(),
  bias: z.enum(['BUY', 'SELL', 'LONG', 'SHORT', 'Buy', 'Sell', 'Long', 'Short', '']).optional(),
  result: z.enum(['WIN', 'LOSS', 'BE', 'Win', 'Loss', 'Breakeven', '']),
  entryType: z.string().trim().optional(),
  rr: z.coerce.number().optional(),
  rResult: z.coerce.number().optional(),
  pips: z.coerce.number().optional(),
  takeProfit: z.coerce.number().optional(),
  takeProfitUSD: z.coerce.number().optional(),
  confirmation: z.string().trim().optional(),
  emotion: z.string().trim().optional(),
  reasonEarlyExit: z.string().trim().optional(),
  marketCondition: z.string().trim().optional(),
  mistakes: z.array(z.string()).optional(),
  disciplineScore: z.coerce.number().min(0).max(100).optional(),
  tradeGrade: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  images: z.array(z.string()).max(5).optional(),
  screenshotUrl: z.string().trim().optional(),
  imageUrl: z.string().trim().optional()
});

const updateTradeSchema = createTradeSchema.partial();

const queryTradeSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(50),
  sortBy: z.string().trim().optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().trim().optional(),
  session: z.string().trim().optional(),
  setupRating: z.string().trim().optional(),
  result: z.string().trim().optional(),
  instrument: z.string().trim().optional(),
  emotion: z.string().trim().optional(),
  view: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional()
});

module.exports = {
  createTradeSchema,
  updateTradeSchema,
  queryTradeSchema
};

