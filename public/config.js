const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isStaticPreview = isLocalHost && ['5500', '5501'].includes(window.location.port);

const API_URL = window.location.protocol === 'file:' || isStaticPreview
  ? 'http://localhost:3000'
  : window.location.origin;



