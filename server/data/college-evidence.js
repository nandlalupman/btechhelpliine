// Field-level facts, paraphrased from institution-owned sources. A fee source
// verifies only its stated course/year/charge; it does not verify placements.
const reviewedAt = '2026-10-28';
module.exports = {
  'mnit-jaipur': {
    institution: 'Malaviya National Institute of Technology Jaipur', reviewedAt,
    feePreview: { amount: 62500, label: 'Standard tuition', period: 'semester', year: '2026-27', scope: 'B.Tech 2026 intake · General/OBC, family income above ₹5 lakh; remission rules apply' },
    feeRows: [
      { label: 'Tuition · General/OBC, family income above ₹5 lakh', amount: 62500, period: 'semester' },
      { label: 'Tuition · General/OBC, family income ₹1–5 lakh', amount: 20834, period: 'semester' },
      { label: 'Tuition · family income below ₹1 lakh or SC/ST/PwD, subject to source rules', amount: 0, period: 'semester' }
    ],
    feeNote: 'Tuition is one component. Institute charges, deposits, hostel and mess are additional. Category/income remission requires the documents and conditions specified by MNIT.',
    sourceYear: '2026-27', feeSource: 'https://www.mnit.ac.in/cms/uploads/2026/05/Fee_UG_2026-27.pdf',
    ranking: { rank: 42, year: 2025, category: 'Engineering', sourceUrl: 'https://www.mnit.ac.in/about_us/nirf', scope: 'Institution-level NIRF ranking; not a branch placement measure.' },
    links: [['Admissions','https://www.mnit.ac.in/students/admissions'],['Scholarships & awards','https://www.mnit.ac.in/students/scholarship']]
  },
  'jecrc-university': {
    institution: 'JECRC University', reviewedAt, sourceYear: '2026-27',
    feePreview: { amount: 245000, label: 'CSE academic fee', period: 'year', year: '2026-27', scope: 'B.Tech CSE · tuition + other academic fee; other programmes differ' },
    feeRows: [
      { label: 'B.Tech CSE · tuition', amount: 174000, period: 'year' },
      { label: 'B.Tech CSE · other academic fee', amount: 71000, period: 'year' },
      { label: 'B.Tech CSE · annual academic total', amount: 245000, period: 'year' },
      { label: 'B.Tech Civil / ECE / Mechanical · annual academic total', amount: 175000, period: 'year' },
      { label: 'Admission & alumni charge', amount: 10000, period: 'one-time' }
    ],
    feeNote: 'The CSE total includes the tuition and other academic fee listed above; do not add the total to its components. Living costs and specialisation-specific differences are not included here.',
    feeSource: 'https://jecrcuniversity.edu.in/fee/', links: [['Current fee schedule','https://jecrcuniversity.edu.in/fee/'],['Official prospectus · 2026','https://jecrcuniversity.edu.in/wp-content/uploads/2026/04/JU-Prospectus-2026.pdf']]
  },
  'bits-pilani': {
    institution: 'BITS Pilani · Pilani campus', reviewedAt, sourceYear: '2026-27',
    feePreview: { amount: 291500, label: 'Semester tuition', period: 'semester', year: '2026-27', scope: 'Domestic first-degree entrants in AY 2026-27 · first / second semester' },
    feeRows: [
      { label: 'Semester tuition · first or second semester', amount: 291500, period: 'semester' },
      { label: 'Hostel · first or second semester', amount: 36000, period: 'semester' },
      { label: 'Mess & electricity advance · adjustable', amount: 10000, period: 'semester' },
      { label: 'Admission fee', amount: 64100, period: 'one-time' }
    ],
    feeNote: 'This is not a complete degree total. The source lists additional advances, deposits, annual charges, optional summer/practice-school charges and future-year increases. Mess is an advance, not a fixed final cost.',
    feeSource: 'https://www.bitsadmission.com/FD/FD_fee.html', links: [['First-degree admissions & fee schedule','https://www.bitsadmission.com/FD/FD_fee.html']]
  },
  'skit-jaipur': {
    institution: 'Swami Keshvanand Institute of Technology, Management & Gramothan, Jaipur', reviewedAt, sourceYear: '2026-27',
    summary: 'The institution publishes B.Tech admission FAQs for 2026-27. Check the current REAP instructions, programme requirements and institution notices before applying.',
    links: [['Admission FAQs · 2026-27','https://www.skit.ac.in/admissions/frequently-asked-queries.html']]
  },
  'poornima-college-of-engineering': {
    institution: 'Poornima College of Engineering, Jaipur', reviewedAt, sourceYear: '2026-27',
    summary: 'Use the Poornima Group college prospectus for this institution. Poornima University is a different listing and its fee schedule must not be substituted.',
    links: [['Poornima Group prospectus · 2026','https://www.poornima.org/public/uploads/PGCProspectus2026.pdf'],['Official college fee page','https://www.poornima.org/fee-details/']]
  }
};
