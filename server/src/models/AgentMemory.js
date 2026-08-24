const mongoose = require('mongoose');

const AgentMemorySchema = new mongoose.Schema(
  {
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
    execution: { type: mongoose.Schema.Types.ObjectId, ref: 'Execution' },
    agent: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    confidence: { type: Number, default: 0 }
  },
  { timestamps: true }
);

AgentMemorySchema.index({ execution: 1, agent: 1 });

module.exports = mongoose.model('AgentMemory', AgentMemorySchema);
