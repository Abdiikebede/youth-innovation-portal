import mongoose from 'mongoose';

const VerificationApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: String,
  lastName: String,
  email: String,
  info: mongoose.Schema.Types.Mixed, // All submitted verification info
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewMessage: String
});

export default mongoose.model('VerificationApplication', VerificationApplicationSchema);
