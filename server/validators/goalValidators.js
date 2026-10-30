const { z } = require('zod');

const updateGoalSchema = z.object({
  monthlyPnlTarget: z.coerce.number().optional(),
  maxDailyDrawdown: z.coerce.number().optional(),
  maxTotalDrawdown: z.coerce.number().optional(),
  profitTargetUSD: z.coerce.number().optional(),
  winRateTarget: z.coerce.number().min(0).max(100).optional(),
  maxTradesPerDay: z.coerce.number().min(1).max(500).optional(),
  riskPerTrade: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().optional()
}).passthrough(); // allows other goal metrics while ensuring types are clean

module.exports = {
  updateGoalSchema
};

