// Run by the shared Component Release workflow inside an organization fork: builds the package of
// the component that fork holds and publishes it as the fork's release, which the manager installs
// by itself. A fork keeps one component release, the newest.
//
//   node publish-component.cjs plan                      which component this repository and ref publish
//   node publish-component.cjs build <source> <output>   build, check and package it
//   node publish-component.cjs publish <package>         zip it, release it, drop the releases before it
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const VERSION = /^\d+(?:[.-][0-9A-Za-z]+)*$/;

// What a repository publishes, from the build manifest: only components marked `release`, under the
// name of the package directory the manager already reads.
function plan({ repository, ref, components = require('./component-repositories.json') }) {
  const entry = Object.values(components).find(item => item.release && item.repository === repository);
  if (!entry) return { publish: false, reason: repository + ' does not publish a component yet' };
  const targets = Object.values(entry.targets);
  if (targets.length !== 1 || !/^local-components\/[a-z0-9-]+$/.test(targets[0].output)) throw Error('A released component needs exactly one package under local-components');
  const result = { component: path.posix.basename(targets[0].output), branch: entry.branch, build: entry.build };
  // A version tag from upstream renumbers the branch head, so it is built again.
  const wanted = ref === 'refs/heads/' + entry.branch || /^refs\/tags\/v\d/.test(ref || '');
  return wanted ? { publish: true, ...result } : { publish: false, reason: ref + ' is not what QAQ-Revival builds from', ...result };
}

// Stored with a fixed date, so the same package always gives the same archive.
function createZip(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const label = Buffer.from(name, 'utf8'), packed = zlib.deflateRawSync(bytes, { level: 9 });
    const fields = Buffer.alloc(26);
    fields.writeUInt16LE(20, 0);
    fields.writeUInt16LE(0x0800, 2);
    fields.writeUInt16LE(8, 4);
    fields.writeUInt16LE(0, 6);
    fields.writeUInt16LE(0x21, 8);
    fields.writeUInt32LE(zlib.crc32(bytes), 10);
    fields.writeUInt32LE(packed.length, 14);
    fields.writeUInt32LE(bytes.length, 18);
    fields.writeUInt16LE(label.length, 22);
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), fields, label, packed]);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    fields.copy(record, 6);
    record.writeUInt32LE(offset, 42);
    locals.push(local);
    central.push(record, label);
    offset += local.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// The package as it will be published. Everything on disk must be what its manifest lists.
function readPackage(directory, { component, repository }) {
  const manifestBytes = fs.readFileSync(path.join(directory, 'component.json')), manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.source !== 'https://github.com/' + repository) throw Error('The package names another source: ' + manifest.source);
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit || '') || manifest.sourceDirty) throw Error('The package does not come from a commit');
  if (!VERSION.test(manifest.version || '') || manifest.version.length > 48) throw Error('The package has no version to publish under');
  const listed = manifest.files && !Array.isArray(manifest.files) ? manifest.files : null;
  if (!listed || !Object.keys(listed).length) throw Error('The package lists no files');
  const files = [{ name: 'component.json', bytes: manifestBytes }];
  const found = fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter(entry => !entry.isDirectory())
    .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).filter(name => name !== 'component.json');
  for (const name of found.sort()) {
    const bytes = fs.readFileSync(path.join(directory, name));
    if (listed[name] !== sha256(bytes)) throw Error('Not what the manifest lists: ' + name);
    files.push({ name, bytes });
  }
  if (found.length !== Object.keys(listed).length) throw Error('The manifest lists files the package does not hold');
  return { manifest, manifestBytes, tag: `${component}-${manifest.version}`, zip: createZip(files) };
}

async function publish({ directory, component, repository, branch, api, upload, log = console.log }) {
  const { manifest, manifestBytes, tag, zip } = readPackage(directory, { component, repository });
  // A push that arrived during the build has its own run behind this one.
  const head = (await api('GET', `/repos/${repository}/git/ref/heads/${branch}`)).object.sha;
  if (head !== manifest.sourceCommit) { log(`${branch} moved to ${head.slice(0, 12)} during the build; the run for it publishes instead`); return { published: false, tag }; }
  const ours = release => new RegExp(`^${component}-\\d`).test(release.tag_name || '');
  const remove = async release => {
    await api('DELETE', `/repos/${repository}/releases/${release.id}`);
    // A draft has no tag yet.
    await api('DELETE', `/repos/${repository}/git/refs/tags/${release.tag_name}`, undefined, [404, 422]);
  };
  const releases = (await api('GET', `/repos/${repository}/releases?per_page=100`)).filter(ours);
  let current = releases.find(release => !release.draft && release.tag_name === tag && release.target_commitish === manifest.sourceCommit
    && ['component.json', component + '.zip'].every(name => release.assets?.some(asset => asset.name === name)));
  if (current) log(`${tag} is already published from ${manifest.sourceCommit.slice(0, 12)}`);
  else {
    // The same number on another commit, or a draft an interrupted run left, would shadow this one.
    for (const release of releases.filter(release => release.draft || release.tag_name === tag)) await remove(release);
    const draft = await api('POST', `/repos/${repository}/releases`, {
      tag_name: tag, target_commitish: manifest.sourceCommit, name: `${component} ${manifest.version}`, draft: true,
      body: `Built from ${manifest.sourceCommit} and checked by the build's own tests. QAQ-Revival offers this package under Settings, next to the build it ships with.`
    });
    await upload(draft, 'component.json', manifestBytes, 'application/json');
    await upload(draft, component + '.zip', zip, 'application/zip');
    // Listed only once both files are there.
    current = await api('PATCH', `/repos/${repository}/releases/${draft.id}`, { draft: false });
    log(`${tag} published: ${zip.length} bytes, sha256 ${sha256(zip)}`);
  }
  for (const release of releases.filter(release => !release.draft && release.tag_name !== tag)) { await remove(release); log('Removed ' + release.tag_name); }
  return { published: true, tag, id: current.id };
}

function githubClient(token) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'User-Agent': 'QAQ-Revival-components', 'X-GitHub-Api-Version': '2022-11-28' };
  async function api(method, route, body, allowed = []) {
    const response = await fetch('https://api.github.com' + route, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    if (allowed.includes(response.status)) return null;
    if (!response.ok) throw Error(`GitHub request failed (${response.status}): ${method} ${route}`);
    return response.status === 204 ? null : response.json();
  }
  async function upload(release, name, bytes, type) {
    const address = release.upload_url.replace(/\{.*$/, '') + '?name=' + encodeURIComponent(name);
    if (!address.startsWith('https://uploads.github.com/')) throw Error('Unexpected upload address');
    const response = await fetch(address, { method: 'POST', headers: { ...headers, 'Content-Type': type, 'Content-Length': String(bytes.length) }, body: bytes, signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw Error(`Upload failed (${response.status}): ${name}`);
  }
  return { api, upload };
}

async function main([command, ...args]) {
  const repository = process.env.GITHUB_REPOSITORY, decided = plan({ repository, ref: process.env.GITHUB_REF });
  if (command === 'plan') {
    if (!decided.publish) console.log(decided.reason);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, ['publish', 'component', 'branch'].map(name => `${name}=${decided[name] ?? ''}\n`).join(''));
    return;
  }
  if (!decided.component) throw Error(decided.reason);
  if (command === 'build') {
    const [source, output] = args.map(value => path.resolve(value));
    return void require(path.join(source, decided.build)).build({ output, work: output + '-work' });
  }
  if (command !== 'publish') throw Error('Unknown command: ' + command);
  if (!process.env.GITHUB_TOKEN) throw Error('GITHUB_TOKEN is required');
  await publish({ directory: path.resolve(args[0]), component: decided.component, repository, branch: decided.branch, ...githubClient(process.env.GITHUB_TOKEN) });
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { plan, createZip, readPackage, publish };
