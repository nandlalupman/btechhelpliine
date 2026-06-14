const mongoose = require('mongoose');

const AffiliationRequestSchema = new mongoose.Schema(
  {
    // Section 1: Basic Profile
    name: {
      type: String,
      required: [true, 'College name is required'],
      trim: true
    },
    establishmentYear: {
      type: Number,
      required: [true, 'Establishment year is required']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    governance: {
      type: String,
      required: [true, 'Governance type is required'],
      enum: ['Government / Public', 'Private University', 'Govt-Aided / Semi-Govt']
    },
    autonomyStatus: {
      type: String,
      required: [true, 'Autonomy status is required'],
      enum: ['Autonomous', 'Non-Autonomous / Affiliated']
    },
    affiliatedUniversity: {
      type: String,
      trim: true,
      default: ''
    },
    aicteApproved: {
      type: Boolean,
      default: false
    },
    ugcRecognized: {
      type: Boolean,
      default: true
    },
    naacRating: {
      type: String,
      trim: true,
      default: ''
    },
    nbaAccredited: {
      type: Boolean,
      default: false
    },
    nbaBranches: {
      type: [String],
      default: []
    },
    nirfRank: {
      type: Number,
      default: null
    },

    // Section 2: Branch Seat Matrix & Collaborations
    branches: [
      {
        branchName: {
          type: String,
          required: true
        },
        totalSeats: {
          type: Number,
          default: 0
        },
        counselingQuotaPercent: {
          type: Number,
          default: 0
        },
        managementQuotaPercent: {
          type: Number,
          default: 0
        },
        nbaAccredited: {
          type: Boolean,
          default: false
        },
        industryCollaborations: {
          type: String,
          trim: true,
          default: ''
        }
      }
    ],

    // Section 3: Exams & Cutoffs
    acceptedExams: {
      type: [String],
      default: []
    },
    stateExamName: {
      type: String,
      trim: true,
      default: ''
    },
    minClass12Percent: {
      type: Number,
      required: [true, 'Minimum Class 12% Criteria is required']
    },
    cutoffs: [
      {
        streamName: {
          type: String,
          required: true
        },
        jeeOpeningRank: {
          type: Number,
          default: null
        },
        jeeClosingRank: {
          type: Number,
          default: null
        },
        stateOpeningRank: {
          type: Number,
          default: null
        },
        stateClosingRank: {
          type: Number,
          default: null
        }
      }
    ],

    // Section 4 & 5: Fee Breakdown
    fees: {
      tuitionGeneral: {
        type: Number,
        required: [true, 'Tuition fee for general seat is required']
      },
      tuitionManagement: {
        type: Number,
        default: null
      },
      admissionDeposit: {
        type: Number,
        default: 0
      },
      admissionDepositRefundable: {
        type: Boolean,
        default: false
      },
      examDevCharges: {
        type: Number,
        default: 0
      },
      hostelNonAC: {
        type: Number,
        default: null
      },
      hostelNonACOccupancy: {
        type: String,
        trim: true,
        default: ''
      },
      hostelAC: {
        type: Number,
        default: null
      },
      hostelACOccupancy: {
        type: String,
        trim: true,
        default: ''
      },
      miscAcademicFees: {
        type: Number,
        default: 0
      }
    },

    // Section 5: Placements
    placements: [
      {
        poolName: {
          type: String,
          required: true
        },
        overallPlacedPercent: {
          type: Number,
          default: 0
        },
        medianCTC: {
          type: Number, // LPA
          default: 0
        },
        averageCTC: {
          type: Number, // LPA
          default: 0
        },
        highestCTC: {
          type: Number, // LPA
          default: 0
        },
        massRecruiterOffers: {
          type: Number,
          default: 0
        }
      }
    ],
    placementPolicy: {
      minCGPA: {
        type: Number,
        default: null
      },
      maxBacklogs: {
        type: Number,
        default: null
      }
    },

    // Academic Rigor & Governance (PDF 2 details)
    cbcsAllowsMinors: {
      type: Boolean,
      default: false
    },
    facultyToStudentRatio: {
      type: Number, // e.g. 15 for 1:15
      default: null
    },
    phdFacultyPercent: {
      type: Number,
      default: null
    },

    // Campus Lifestyle & Strictness Metrics
    lifestyle: {
      curfewPolicy: {
        type: String,
        enum: ['Strict early curfew (Before 7:30 PM)', 'Moderate curfew (8:30 PM - 10:00 PM)', 'High flexibility / 24x7 unrestricted campus accessibility']
      },
      dressCode: {
        type: String,
        enum: ['Complete Mandatory Institutional Uniform / Everyday Formals', 'Casual Wear Allowed (With minimal restrictions)']
      },
      attendanceEnforcement: {
        type: String,
        enum: ['Highly Strict: Strict detention / debarment if below 75%', 'Moderate: Medical/Extracurricular leaves easily compensated', 'Flexible: Active project/coding time counted towards attendance']
      },
      distanceToMetroBusKM: {
        type: Number,
        default: null
      },
      distanceToRailwayKM: {
        type: Number,
        default: null
      },
      activeIncubationCenter: {
        type: Boolean,
        default: false
      },
      totalCodingClubs: {
        type: Number,
        default: 0
      }
    },

    // Verification
    submittedBy: {
      type: String,
      required: [true, 'Submitted by name is required'],
      trim: true
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true
    },
    attestationConsent: {
      type: Boolean,
      required: [true, 'Attestation consent is required'],
      enum: [true] // Must be checked/true
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    bannerUrl: {
      type: String,
      default: null
    },
    facilities: [
      {
        category: {
          type: String,
          enum: ['Classroom', 'Laboratory', 'Library', 'Hostel', 'Sports', 'Cafeteria', 'Other'],
          required: true
        },
        imageUrl: { type: String, required: true },
        caption: { type: String, default: '' }
      }
    ]
  },
  {
    timestamps: true
  }
);

AffiliationRequestSchema.pre('save', function (next) {
  if (this.branches && this.branches.length > 0) {
    const accredited = this.branches
      .filter(b => b.nbaAccredited)
      .map(b => b.branchName);
    
    if (accredited.length > 0) {
      this.nbaBranches = accredited;
    } else {
      this.nbaBranches = [];
    }
  }
  
  if (this.nbaBranches && this.nbaBranches.length > 0) {
    this.nbaAccredited = true;
  } else {
    this.nbaAccredited = false;
  }
  next();
});

module.exports = mongoose.model('AffiliationRequest', AffiliationRequestSchema);
