const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { imageUrl } = require('./character-catalog.cjs');

const COVER_SCHEME = 'qaq-character-cover';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');

function imageType(bytes) {
  if (bytes.length >= 32 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg';
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length) return 'image/webp';
  if (bytes.length >= 14 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) && bytes[bytes.length - 1] === 0x3b) return 'image/gif';
  if (bytes.length >= 54 && bytes.toString('ascii', 0, 2) === 'BM' && bytes.readUInt32LE(2) === bytes.length) return 'image/bmp';
  return null;
}

function createCharacterImageCache({ cacheDir, fetchFn = fetch, onCacheError = () => {} }) {
  const pending = new Map();
  const queue = [];
  let active = 0;
  async function withDownloadSlot(download) {
    if (active >= 4) await new Promise(resolve => queue.push(resolve));
    else active++;
    try { return await download(); }
    finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  }
  async function download(url) {
    const signal = AbortSignal.timeout(15000);
    let current = url;
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetchFn(current, { signal, redirect: 'manual', credentials: 'omit' });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        current = location && imageUrl(new URL(location, current).href);
        if (!current) throw Error('Invalid character image redirect');
        continue;
      }
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
        await response.body?.cancel();
        throw Error(`Character image request failed (HTTP ${response.status}) or is too large`);
      }
      const chunks = [];
      let size = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_IMAGE_BYTES) throw Error('Character image is too large');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); }
      const bytes = Buffer.concat(chunks);
      const mime = imageType(bytes);
      if (!mime) throw Error('Invalid character image');
      return { bytes, mime };
    }
    throw Error('Too many character image redirects');
  }
  async function load(url, fallbacks) {
    // The full source URL is the key: changed URLs fetch new art, old URLs stay usable offline.
    const file = path.join(cacheDir, hash(url) + '.img');
    try {
      const stat = await fs.stat(file);
      if (stat.isFile() && stat.size <= MAX_IMAGE_BYTES) {
        const bytes = await fs.readFile(file);
        const mime = imageType(bytes);
        if (mime) return { bytes, mime };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') onCacheError(error);
    }
    return withDownloadSlot(async () => {
      let image, failure;
      for (const candidate of [url, ...fallbacks]) {
        try { image = await download(candidate); break; }
        catch (error) { failure = error; }
      }
      if (!image) throw failure;
      const temporary = file + '.' + randomUUID() + '.tmp';
      try {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(temporary, image.bytes, { flag: 'wx' });
        await fs.rename(temporary, file);
      } catch (error) {
        // A read-only/full cache must not prevent displaying a successfully downloaded image.
        onCacheError(error);
      } finally { await fs.unlink(temporary).catch(() => {}); }
      return image;
    });
  }
  function safeFallbacks(source, values) {
    return [...new Set((Array.isArray(values) ? values : []).map(imageUrl).filter(url => url && url !== source))].slice(0, 2);
  }
  function get(source, fallbackSources = []) {
    const url = imageUrl(source);
    if (!url) return Promise.reject(Error('Invalid character image URL'));
    const fallbacks = safeFallbacks(url, fallbackSources);
    const requestKey = [url, ...fallbacks].join('\n');
    if (!pending.has(requestKey)) {
      const request = load(url, fallbacks).finally(() => pending.delete(requestKey));
      pending.set(requestKey, request);
    }
    return pending.get(requestKey);
  }
  function coverUrl(source, fallbackSources = []) {
    const url = imageUrl(source);
    if (!url) return null;
    const fallbacks = safeFallbacks(url, fallbackSources).map(value => '&fallback=' + encodeURIComponent(value)).join('');
    return `${COVER_SCHEME}://image/?url=${encodeURIComponent(url)}${fallbacks}`;
  }
  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET' || url.protocol !== COVER_SCHEME + ':' || url.host !== 'image' || url.pathname !== '/') {
        return new Response(null, { status: 400 });
      }
      const { bytes, mime } = await get(url.searchParams.get('url'), url.searchParams.getAll('fallback'));
      return new Response(bytes, { headers: {
        'Content-Type': mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'
      } });
    } catch {
      // Failures are never cached, so a later load can retry after the connection recovers.
      return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  return { get, coverUrl, handle };
}

module.exports = { COVER_SCHEME, MAX_IMAGE_BYTES, createCharacterImageCache };
