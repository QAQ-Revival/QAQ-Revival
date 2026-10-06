'use strict';
const SOURCES = {
  pawchive: { site: 'https://pawchive.pw', files: 'https://file.pawchive.pw', media: 'https://img.pawchive.pw' },
  kemono: { site: 'https://kemono.cr', files: 'https://kemono.cr', media: 'https://img.kemono.cr' }
};
const IMAGE_EXTENSION = /\.(?:jpe?g|png|gif|webp|avif|bmp|apng|svg|ico|tiff?|heic|heif|jxl)(?:$|[?#])/i;
function isImageFile(file) {
  return !!file && (file.isImage === true || IMAGE_EXTENSION.test(file.path || '') || IMAGE_EXTENSION.test(file.name || '') || /^image\//i.test(file.mime || file.mime_type || file.content_type || ''));
}
function allowedFileUrl(value, sourceId) {
  const source = SOURCES[sourceId];
  if (!source) return false;
  try {
    const url = new URL(value);
    const domain = new URL(source.site).hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === domain || url.hostname.endsWith('.' + domain)) && /^\/data\/[a-zA-Z0-9/_.-]+$/.test(url.pathname) && !url.pathname.includes('..');
  } catch { return false; }
}
function mediaFile(value, sourceId) {
  const source = SOURCES[sourceId];
  if (!source || !value || typeof value.path !== 'string' || !/^\/[a-zA-Z0-9/_.-]+$/.test(value.path) || value.path.includes('..')) return null;
  const name = String(value.name || value.path.split('/').at(-1)).slice(0, 500);
  const image = isImageFile(value), previewOnly = value.preview_only === true;
  // Kemono detail attachments/previews carry their own CDN server; Pawchive uses file.pawchive.pw.
  let server = source.files;
  try {
    if (value.server && allowedFileUrl(new URL('/data' + value.path, value.server).href, sourceId)) server = value.server;
  } catch { /* Invalid metadata falls back to the source's canonical host. */ }
  const url = new URL('/data' + value.path, server);
  url.searchParams.set('f', name);
  const thumbnail = image ? `${source.media}/thumbnail/data${value.path}` : '';
  return { name, path: value.path, isImage: image, previewOnly, thumbnail,
    url: previewOnly ? thumbnail : url.href };
}
function mergeDetailFiles(post, detail) {
  const metadata = new Map();
  for (const key of ['attachments', 'previews', 'videos']) for (const file of Array.isArray(detail?.[key]) ? detail[key] : []) {
    if (file?.path) metadata.set(file.path, { ...metadata.get(file.path), ...file });
  }
  const enrich = file => file ? { ...file, ...metadata.get(file.path) } : file;
  const attachments = [...new Map([...(post.attachments || []), ...(detail.attachments || [])].map(enrich).filter(Boolean).map(file => [file.path, file])).values()];
  return { ...post, file: enrich(post.file), attachments };
}
module.exports = { mediaFile, isImageFile, allowedFileUrl, mergeDetailFiles };
