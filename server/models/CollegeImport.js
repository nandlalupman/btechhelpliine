const mongoose = require('mongoose');

// Keep the import identity after a college is deleted, so a later refresh
// cannot resurrect an entry the administrator deliberately removed.
module.exports = mongoose.model('CollegeImport', new mongoose.Schema({
  sourceId: { type: String, required: true, unique: true },
  collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
  managedFields: { type: mongoose.Schema.Types.Mixed, default: null },
  revision: { type: String, default: '' }
}, { timestamps: true }));
