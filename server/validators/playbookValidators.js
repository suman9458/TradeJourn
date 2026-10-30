const { z } = require('zod');

const updatePlaybookSchema = z.object({
  entryRules: z.array(z.string().trim()).optional(),
  riskRules: z.array(z.string().trim()).optional(),
  exitRules: z.array(z.string().trim()).optional(),
  psychologyRules: z.array(z.string().trim()).optional()
});

module.exports = {
  updatePlaybookSchema
};

