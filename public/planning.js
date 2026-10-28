(function (root) {
  function budget(values) {
    const keys = ['tuition', 'hostel', 'mess', 'other', 'oneTime', 'increase'];
    const n = Object.fromEntries(keys.map(key => [key, Number(values[key] || 0)]));
    if (keys.some(key => !Number.isFinite(n[key]) || n[key] < 0) || n.increase > 30 || keys.filter(k => k !== 'increase').some(k => n[k] > 10000000)) throw new Error('Enter valid non-negative costs and an annual increase between 0 and 30%.');
    const annual = n.tuition + n.hostel + n.mess + n.other;
    const years = Array.from({ length: 4 }, (_, i) => annual * (1 + n.increase / 100) ** i + (i === 0 ? n.oneTime : 0));
    return { years, total: years.reduce((a, b) => a + b, 0) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { budget };
  else root.BtechPlanning = { budget };
})(typeof window === 'undefined' ? {} : window);
