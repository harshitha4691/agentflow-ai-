const mongoose = require('mongoose');

const ExecutionLogSchema = new mongoose.Schema(
  {
    execution: { type: mongoose.Schema.Types.ObjectId, ref: 'Execution', required: true },
    workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
    nodeId: { type: String, default: null },
    agent: { type: String, required: true },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info'
    },
    event: { type: String, default: '' },
    message: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

ExecutionLogSchema.index({ execution: 1, createdAt: 1 });

module.exports = mongoose.model('ExecutionLog', ExecutionLogSchema);
