// Reviews may contain images from older, unmoderated submissions. Only bounded,
// embedded raster images are returned; arbitrary URLs/HTML are never rendered.
const valid = value => typeof value === 'string' && value.length <= 400000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
const images = values => Array.isArray(values) ? values.filter(valid).slice(0, 3) : [];
module.exports = { valid, images };
