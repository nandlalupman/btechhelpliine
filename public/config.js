const API_URL = window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);



