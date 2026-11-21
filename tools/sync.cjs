// Keeps every external source current and records it, children before parents: an organization
// fork merges its upstream, an unmodified dependency follows its upstream branch, and each parent
// commits the revisions its children moved to. A step that does not go through is undone and
// reported; it never holds up the rest.
//
//   node tools/sync.cjs status              what is waiting, read from GitHub without a checkout
//   node tools/sync.cjs run [--no-push]     merge, verify, commit and publish
//   node tools/sync.cjs deploy [target...]  rebuild components whose source moved and install them
//   node tools/sync.cjs tags                fetch the version tags the component builds read
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { verifyDownstream } = require('./verify-downstream.cjs');
const root = path.resolve(__dirname, '..');

const relative = (from, to) => path.relative(from, to).split(path.sep).join('/');
const list = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
const head = (git, directory) => git(directory, ['rev-parse', 'HEAD']).stdout;
const contains = (git, directory, ancestor, descendant) => git(directory, ['merge-base', '--is-ancestor', ancestor, descendant], { allowed: [0, 1] }).status === 0;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Children come before their parent, a fork before the copies of it and before a fork that merges it.
function createPlan(manifest, base = root, url = repository => `https://github.com/${repository}.git`) {
  const nodes = [{ kind: 'root', name: manifest.root || 'QAQ-Revival', branch: 'main', path: '' }];
  for (const item of manifest.owned || []) nodes.push({ kind: 'owned', ...item });
  for (const item of manifest.forks || []) nodes.push({ kind: 'fork', ...item });
  for (const item of manifest.tracked || []) nodes.push({ kind: 'tracked', name: item.upstream.split('/')[1], ...item });
  for (const fork of nodes.filter(node => node.copies)) for (const copy of fork.copies) nodes.push({ kind: 'copy', name: fork.name, branch: fork.branch, path: copy, source: fork });
  for (const node of nodes) {
    node.directory = path.join(base, node.path);
    node.repository = node.kind === 'tracked' ? node.upstream : `${manifest.owner}/${node.name}`;
    if (node.kind !== 'tracked') node.origin = url(node.repository);
    if (node.upstream) node.upstreamUrl = url(node.upstream);
    node.children = [];
    node.parent = node.kind === 'root' ? null : nodes
      .filter(other => other !== node && !['tracked', 'copy'].includes(other.kind) && (other.path === '' || node.path.startsWith(other.path + '/')))
      .sort((a, b) => b.path.length - a.path.length)[0];
  }
  for (const node of nodes) {
    if (node.parent) node.parent.children.push(node);
    node.sources = (node.also || []).map(source => {
      const fork = nodes.find(other => other.kind === 'fork' && `${other.name}@${other.branch}` === source);
      if (!fork) throw Error('Unregistered fix source: ' + source);
      return fork;
    });
  }
  const plan = [], seen = new Set();
  const visit = node => {
    if (seen.has(node)) return;
    seen.add(node);
    for (const dependency of [...node.children, ...(node.source ? [node.source] : []), ...node.sources]) visit(dependency);
    plan.push(node);
  };
  nodes.forEach(visit);
  return plan;
}

function fetchVersionTags(git, directory, remote, repository) {
  const pattern = repository === 'XXMI-Libs-Vulkan'
    ? /^refs\/tags\/v\d+\.\d+\.\d+-nhd\.\d+$/
    : /^refs\/tags\/v\d+\.\d+\.\d+(?:\.\d+)?$/;
  const refs = git(directory, ['ls-remote', '--tags', '--refs', remote]).stdout.split(/\r?\n/)
    .map(line => line.split(/\s+/)).filter(([, ref]) => pattern.test(ref || ''));
  const missing = [];
  for (const [object, ref] of refs) {
    const local = git(directory, ['rev-parse', '--verify', ref], { allowed: [0, 1, 128] });
    if (local.status === 0 && local.stdout !== object) throw Error('Version tag differs from its source: ' + ref);
    if (local.status !== 0) missing.push(`${ref}:${ref}`);
  }
  if (missing.length) git(directory, ['fetch', '--no-tags', remote, ...missing]);
  return refs;
}

function publishVersionTags(git, directory, refs, revision = 'HEAD') {
  const origin = new Map(git(directory, ['ls-remote', '--tags', '--refs', 'origin']).stdout.split(/\r?\n/).map(line => {
    const [object, ref] = line.split(/\s+/); return [ref, object];
  }));
  const missing = [];
  for (const [object, ref] of refs) {
    if (!contains(git, directory, `${ref}^{commit}`, revision)) continue;
    if (origin.has(ref) && origin.get(ref) !== object) throw Error('Organization version tag already has a different target: ' + ref);
    if (!origin.has(ref)) missing.push(`${ref}:${ref}`);
  }
  if (missing.length) git(directory, ['push', 'origin', ...missing]);
}

// `managed` names the submodules whose revision the sync sets itself right after the merge,
// so a disagreement over one of them is not a conflict anyone has to settle.
function mergeUpstream(git, directory, upstreamRef, verify = () => {}, message = 'Merge ' + upstreamRef, managed = []) {
  if (contains(git, directory, upstreamRef, 'HEAD')) { verify(false); return false; }
  const result = git(directory, ['merge', '--no-commit', upstreamRef], { allowed: [0, 1] });
  if (result.status) {
    const unmerged = git(directory, ['diff', '--name-only', '--diff-filter=U']).stdout.split(/\r?\n/).filter(Boolean);
    if (!unmerged.length || unmerged.some(file => !managed.includes(file))) throw Error('Upstream merge conflict in ' + (unmerged.join(', ') || 'the tree') + '; the review checkout is preserved at ' + directory);
    git(directory, ['reset', '-q', 'HEAD', '--', ...unmerged]);
  }
  git(directory, ['diff', '--check']);
  verify(true);
  if (git(directory, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { allowed: [0, 1, 128] }).status === 0) git(directory, ['commit', '--no-gpg-sign', '-m', message]);
  return true;
}

function restore(git, directory, revision) {
  git(directory, ['merge', '--abort'], { allowed: [0, 1, 128] });
  // A fast-forward has already moved HEAD by the time its check fails.
  git(directory, ['reset', '--hard', '-q', revision]);
}

function mergeOptional(git, directory, upstreamRef, verify, message, managed) {
  const before = head(git, directory);
  try {
    return { changed: mergeUpstream(git, directory, upstreamRef, verify, message, managed) };
  } catch (error) {
    restore(git, directory, before);
    return { changed: false, skipped: error.message };
  }
}

function requireClean(git, directory) {
  if (git(directory, ['status', '--porcelain', '--ignore-submodules=all']).stdout) throw Error('Uncommitted changes in ' + directory);
}

function setRemote(git, directory, name, url) {
  if (git(directory, ['remote']).stdout.split(/\r?\n/).includes(name)) git(directory, ['remote', 'set-url', name, url]);
  else git(directory, ['remote', 'add', name, url]);
  git(directory, ['remote', 'set-url', '--push', name, 'disabled://read-only']);
}

// Puts a repository the organization owns on its branch, at the published tip or at reviewed local commits beyond it.
function settle(git, node) {
  const directory = node.directory, remote = `refs/remotes/origin/${node.branch}`;
  if (git(directory, ['remote', 'get-url', 'origin']).stdout.replace(/\.git$/, '') !== node.origin.replace(/\.git$/, '')) throw Error('Unexpected origin for ' + node.name);
  requireClean(git, directory);
  git(directory, ['fetch', '--no-tags', '--no-recurse-submodules', 'origin', `+refs/heads/${node.branch}:${remote}`]);
  const ahead = contains(git, directory, remote, 'HEAD');
  if (!ahead && !contains(git, directory, 'HEAD', remote)) throw Error(`${node.name} has local commits that diverge from the organization branch`);
  const target = git(directory, ['rev-parse', ahead ? 'HEAD' : remote]).stdout;
  const local = git(directory, ['rev-parse', '-q', '--verify', 'refs/heads/' + node.branch], { allowed: [0, 1, 128] });
  if (local.status === 0 && !contains(git, directory, local.stdout, target)) throw Error(`${node.name} keeps commits on its local ${node.branch} branch that are not checked out`);
  git(directory, ['checkout', '-q', '-B', node.branch, target]);
}

function mergeSources(git, node, managed) {
  const directory = node.directory, branch = node.upstreamBranch || node.branch;
  setRemote(git, directory, 'upstream', node.upstreamUrl);
  git(directory, ['fetch', '--no-tags', '--no-recurse-submodules', 'upstream', `+refs/heads/${branch}:refs/remotes/upstream/${branch}`]);
  // The runtime generates its PE version with git describe, and wwmi-dx12 counts its build number
  // from the upstream release tag. A release can tag a commit that was merged earlier.
  const tags = node.versionTags ? fetchVersionTags(git, directory, node.versionTags, node.name) : [];
  mergeUpstream(git, directory, `upstream/${branch}`, undefined, `Merge upstream ${node.upstream} into ${node.branch}`, managed);
  for (const source of node.sources) {
    // Taken from the checkout beside this one, which already holds what this run merged into it.
    const ref = `refs/remotes/fixes-${source.name.toLowerCase()}/${source.branch}`;
    git(directory, ['fetch', '--no-tags', '--no-recurse-submodules', source.directory, `+refs/heads/${source.branch}:${ref}`]);
    mergeUpstream(git, directory, ref, undefined, `Merge ${source.repository} ${source.branch} into ${node.branch}`, managed);
  }
  return tags;
}

function advanceTracked(git, node) {
  const directory = node.directory, remote = `refs/remotes/origin/${node.branch}`;
  requireClean(git, directory);
  if (git(directory, ['remote', 'get-url', 'origin']).stdout !== node.upstreamUrl) git(directory, ['remote', 'set-url', 'origin', node.upstreamUrl]);
  git(directory, ['fetch', '--no-tags', '--no-recurse-submodules', 'origin', `+refs/heads/${node.branch}:${remote}`]);
  if (contains(git, directory, remote, 'HEAD')) return;
  if (!contains(git, directory, 'HEAD', remote)) throw Error(`${node.upstream} ${node.branch} no longer contains the recorded commit`);
  git(directory, ['checkout', '-q', '--detach', remote]);
  if (fs.existsSync(path.join(directory, '.gitmodules'))) {
    git(directory, ['submodule', 'sync', '--recursive']);
    git(directory, ['submodule', 'update', '--init', '--recursive']);
  }
}

function advanceCopy(git, node, revision) {
  const directory = node.directory;
  if (head(git, directory) === revision) return;
  requireClean(git, directory);
  git(directory, ['fetch', '--no-tags', '--no-recurse-submodules', node.source.directory, revision]);
  git(directory, ['checkout', '-q', '--detach', revision]);
}

// Commits the revisions the children reached. A child that was held back keeps what the parent recorded.
function recordChildren(git, node, states) {
  const moved = [];
  for (const child of node.children) {
    const state = states.get(child);
    if (!state?.revision || state.held) continue;
    const entry = relative(node.directory, child.directory);
    if (git(node.directory, ['rev-parse', '-q', '--verify', `HEAD:${entry}`], { allowed: [0, 1, 128] }).stdout === state.revision) continue;
    git(node.directory, ['update-index', '--cacheinfo', `160000,${state.revision},${entry}`]);
    moved.push(child.name);
  }
  if (moved.length) git(node.directory, ['commit', '--no-gpg-sign', '-m', 'Update ' + list([...new Set(moved)])]);
}

function verifyByCommand(node) {
  const env = { ...process.env };
  delete env.QAQR_GITHUB_APP_PRIVATE_KEY;
  const python = path.join(root, '.cache/python312/python.exe');
  if (!env.QAQR_PYTHON && fs.existsSync(python)) env.QAQR_PYTHON = python;
  const result = spawnSync(process.execPath, [path.join(node.directory, node.verify[0]), ...node.verify.slice(1)], { cwd: node.directory, env, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status) throw result.error || Error(`${node.name} did not pass its own build check`);
}

// Reads one member of a zip archive with the bsdtar Windows ships; the member is never executed.
function zipMember(bytes, name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-official-'));
  try {
    const archive = path.join(directory, 'package.zip'), tar = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/tar.exe');
    fs.writeFileSync(archive, bytes);
    const run = args => {
      const result = spawnSync(tar, args, { windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
      if (result.error || result.status) throw result.error || Error('Cannot read the official package');
      return result.stdout;
    };
    const members = run(['-tf', archive]).toString('utf8').split(/\r?\n/).filter(entry => entry.split('/').at(-1).toLowerCase() === name);
    if (members.length !== 1) throw Error(`The official package holds ${members.length} files named ${name}`);
    return run(['-xOf', archive, members[0]]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

// QAQR swaps its build in only over an official runtime it knows. Once the fork contains a new
// upstream release, that release's DLL is the one users will have, so its hash is recorded here.
async function downloadPackage(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw Error('Cannot download the official package: ' + (error.cause?.message || error.message));
      await new Promise(resolve => setTimeout(resolve, attempt * 3000));
    }
  }
}

async function acceptOfficialRuntime(git, node, api, download = downloadPackage) {
  const directory = node.directory, file = path.join(directory, 'qaqr/changes.json'), pattern = new RegExp(node.officialRuntime, 'i');
  for (const release of await api(`/repos/${node.upstream}/releases?per_page=10`)) {
    if (!/^v[\w.-]+$/.test(release.tag_name)) continue;
    const commit = git(directory, ['rev-parse', '-q', '--verify', `refs/tags/${release.tag_name}^{commit}`], { allowed: [0, 1, 128] });
    if (commit.status || !contains(git, directory, commit.stdout, 'HEAD')) continue;
    const asset = release.assets.find(item => pattern.test(item.name));
    if (!asset || !/^sha256:[0-9a-f]{64}$/.test(asset.digest || '')) throw Error(`${release.tag_name} has no official package with a recorded digest`);
    if (!asset.browser_download_url.startsWith(`https://github.com/${node.upstream}/releases/download/`)) throw Error('Unexpected official package address');
    const bytes = await download(asset.browser_download_url);
    if ('sha256:' + sha256(bytes) !== asset.digest) throw Error('The official package does not match its recorded digest');
    const runtime = sha256(zipMember(bytes, 'd3d11.dll'));
    const text = fs.readFileSync(file, 'utf8'), data = JSON.parse(text);
    if (data.compatibleRuntimeHashes.includes(runtime)) return false;
    data.compatibleRuntimeHashes.push(runtime);
    fs.writeFileSync(file, (JSON.stringify(data, null, 2) + '\n').replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n'));
    git(directory, ['add', '--', 'qaqr/changes.json']);
    git(directory, ['commit', '--no-gpg-sign', '-m', `Accept the official ${release.tag_name} runtime`]);
    return true;
  }
  return false;
}

// A fresh clone has none of the submodules. A child is handled before its parent, so the
// parents above it are checked out first, at the revision the level above records.
function ensureCheckout(git, node) {
  if (node.kind === 'root' || fs.existsSync(path.join(node.directory, '.git'))) return;
  ensureCheckout(git, node.parent);
  git(node.parent.directory, ['submodule', 'update', '--init', '--', relative(node.parent.directory, node.directory)]);
}

async function advance(git, node, state, states, { api, verify, official, check }) {
  const directory = node.directory;
  if (node.kind === 'tracked') return advanceTracked(git, node);
  if (node.kind === 'copy') return advanceCopy(git, node, states.get(node.source).revision);
  settle(git, node);
  const managed = node.children.map(child => relative(directory, child.directory));
  if (node.kind === 'fork' && !node.pinned) state.tags = mergeSources(git, node, managed);
  if (node.officialRuntime) {
    // Only a merge or a release tag the organization has not seen can bring a runtime that is not recorded yet.
    const known = new Set(git(directory, ['ls-remote', '--tags', '--refs', 'origin']).stdout.split(/\r?\n/).map(line => line.split(/\s+/)[1]));
    const released = state.tags.some(([, ref]) => !known.has(ref) && contains(git, directory, `${ref}^{commit}`, 'HEAD'));
    if (released || head(git, directory) !== state.before) await official(git, node, api);
  }
  recordChildren(git, node, states);
  if (head(git, directory) === state.before) return;
  // The submodules nobody manages here follow whatever this commit pins.
  if (node.kind !== 'root' && fs.existsSync(path.join(directory, '.gitmodules'))) git(directory, ['submodule', 'update', '--init', '--recursive']);
  check(directory, node.name);
  if (node.verify) verify(node);
}

function publish(git, plan, states) {
  for (const node of plan) {
    const state = states.get(node);
    if (!node.origin || node.kind === 'copy' || state.held || !state.revision) continue;
    const blocked = node.children.find(child => states.get(child).unpublished);
    try {
      if (blocked) throw Error(`${blocked.name} was not published`);
      const directory = node.directory, ref = `refs/heads/${node.branch}`;
      const remote = git(directory, ['ls-remote', '--exit-code', '--heads', 'origin', ref]).stdout.split(/\s/)[0];
      if (remote !== state.revision) {
        if (git(directory, ['cat-file', '-e', remote + '^{commit}'], { allowed: [0, 1, 128] }).status || !contains(git, directory, remote, state.revision)) throw Error('the organization branch moved during the run');
        if (node.lfs && node.upstream) {
          git(directory, ['lfs', 'fetch', 'upstream', 'upstream/' + (node.upstreamBranch || node.branch)]);
          git(directory, ['lfs', 'push', 'origin', state.revision]);
        }
        git(directory, ['push', 'origin', `${state.revision}:${ref}`]);
        state.published = true;
      }
      if (node.versionTags === 'upstream') publishVersionTags(git, directory, state.tags || [], state.revision);
    } catch (error) {
      state.unpublished = true;
      state.held = 'Not published: ' + error.message;
    }
  }
}

async function synchronize({ plan, git, api, push = true, log = console.log, verify = verifyByCommand, official = acceptOfficialRuntime, check = verifyDownstream }) {
  const states = new Map();
  for (const node of plan) {
    const state = { node, held: null };
    states.set(node, state);
    try {
      ensureCheckout(git, node);
      state.before = head(git, node.directory);
      await advance(git, node, state, states, { api, verify, official, check });
      state.revision = head(git, node.directory);
    } catch (error) {
      state.held = error.message.split(/\r?\n/)[0];
      if (state.before) {
        restore(git, node.directory, state.before);
        // Children go back to what this parent records; their own results are published by revision.
        if (node.kind !== 'root' && fs.existsSync(path.join(node.directory, '.gitmodules'))) git(node.directory, ['submodule', 'update', '--init', '--recursive'], { allowed: [0, 1] });
      }
      state.revision = state.before;
    }
  }
  if (push) publish(git, plan, states);
  const report = plan.map(node => {
    const state = states.get(node);
    return { name: node.name, kind: node.kind, path: node.path || '.', before: state.before, revision: state.revision, changed: !!state.revision && state.revision !== state.before, published: !!state.published, held: state.held };
  });
  for (const row of report) if (row.held || row.changed || row.published) log(`${row.path}: ${row.held ? 'held back: ' + row.held : (row.changed ? 'updated to ' : 'at ') + row.revision.slice(0, 12) + (row.published ? ', published' : '')}`);
  if (!report.some(row => row.held || row.changed || row.published)) log('Everything is up to date');
  return report;
}

// Reads GitHub only, so a scheduled run costs seconds when nothing has moved.
async function status({ plan, api, owner }) {
  const tip = async (repository, branch) => (await api(`/repos/${repository}/git/ref/heads/${branch}`)).object.sha;
  const ahead = async (repository, base, target) => {
    if (base === target) return 0;
    const comparison = await api(`/repos/${repository}/compare/${base}...${target}`, { allowed: [404] });
    return comparison.status === 404 ? 1 : comparison.ahead_by;
  };
  const recorded = async node => (await api(`/repos/${owner}/${node.parent.name}/contents/${relative(node.parent.directory, node.directory)}?ref=${node.parent.branch}`)).sha;
  const versionTags = async repository => {
    const pattern = repository.endsWith('/XXMI-Libs-Vulkan') || repository.endsWith('/XXMI-Libs-Package-Forked') ? /^refs\/tags\/v\d+\.\d+\.\d+-nhd\.\d+$/ : /^refs\/tags\/v\d+\.\d+\.\d+(?:\.\d+)?$/;
    const tags = new Map();
    for (let page = 1; page < 10; page++) {
      const refs = await api(`/repos/${repository}/git/matching-refs/tags/v?per_page=100&page=${page}`);
      for (const ref of refs) if (pattern.test(ref.ref)) tags.set(ref.ref, ref.object);
      if (refs.length < 100) break;
    }
    return tags;
  };
  return Promise.all(plan.filter(node => node.kind !== 'root').map(async node => {
    const row = { name: node.name, kind: node.kind, path: node.path, pending: [] };
    if (node.kind === 'tracked') {
      const [upstream, record] = await Promise.all([tip(node.upstream, node.branch), recorded(node)]);
      if (upstream !== record) row.pending.push('upstream moved to ' + upstream.slice(0, 12));
      return row;
    }
    const organization = await tip(node.repository, node.branch);
    if (node.kind === 'fork' && !node.pinned) {
      const incoming = await ahead(node.repository, organization, await tip(node.upstream, node.upstreamBranch || node.branch));
      if (incoming) row.pending.push(`${incoming} upstream commit${incoming > 1 ? 's' : ''}`);
      for (const source of node.sources) {
        const fixes = await ahead(node.repository, organization, await tip(source.repository, source.branch));
        if (fixes) row.pending.push(`${fixes} commit${fixes > 1 ? 's' : ''} from ${source.name}`);
      }
      if (node.versionTags) {
        const [theirs, ours] = await Promise.all([versionTags(node.upstream), versionTags(node.repository)]);
        for (const [ref, object] of theirs) {
          if (ours.has(ref)) continue;
          const commit = object.type === 'tag' ? (await api(`/repos/${node.upstream}/git/tags/${object.sha}`)).object.sha : object.sha;
          if (await ahead(node.repository, organization, commit) === 0) row.pending.push('version tag ' + ref.slice(10));
        }
      }
    }
    if (await recorded(node) !== organization) row.pending.push('not recorded by ' + node.parent.name);
    return row;
  }));
}

function hashTree(directory) {
  const files = {};
  for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
    const file = path.join(entry.parentPath, entry.name);
    if (entry.isSymbolicLink()) throw Error('Linked package entry: ' + file);
    if (entry.isFile()) files[relative(directory, file)] = sha256(fs.readFileSync(file));
  }
  return files;
}
const sameTree = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// Rebuilds each component whose source is no longer the commit its package came from, then swaps the
// package into the workspace, the portable build and the installed application, or into none of them.
function deploy({ targets = [], install = process.env.QAQR_INSTALL_DIR || 'D:/QAQ-Revival', force = false, dryRun = false, log = console.log, base = root, components = require('./component-repositories.json'), build = require('./build-components.cjs').buildComponent } = {}) {
  const cache = path.join(base, '.cache/sync'), stateFile = path.join(cache, 'deployed.json');
  fs.mkdirSync(path.join(cache, 'swap'), { recursive: true });
  const deployed = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const python = path.join(base, '.cache/python312/python.exe');
  if (!process.env.QAQR_PYTHON && fs.existsSync(python)) process.env.QAQR_PYTHON = python;
  const applications = [path.join(base, 'build/QAQ-Revival-local'), install && path.resolve(install)].filter(directory => directory && fs.existsSync(path.join(directory, 'resources/app/package.json')));
  const place = (application, output) => output.startsWith('local-components/') ? path.join(application, output) : path.join(application, 'resources', output);
  const git = (directory, args) => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true });
    if (result.status) throw Error('Git ' + args[0] + ' failed in ' + directory);
    return result.stdout.trim();
  };
  const swaps = [], built = {};
  let planned = 0;
  for (const component of Object.values(components)) for (const [target, options] of Object.entries(component.targets)) {
    if (targets.length ? !targets.includes(target) : !/^(local-components|app\/resources)\//.test(options.output)) continue;
    if (!/^(local-components|app\/resources)\//.test(options.output)) throw Error(target + ' is not a deployable package');
    const source = path.join(base, component.source), current = path.join(base, options.output);
    const revision = git(source, ['rev-parse', 'HEAD']);
    if (git(source, ['status', '--porcelain', '--ignore-submodules=all'])) {
      if (targets.includes(target)) throw Error('Commit the changes in ' + component.source + ' before deploying ' + target);
      log(`${target}: skipped, ${component.source} has uncommitted changes`);
      continue;
    }
    const manifestFile = path.join(current, 'component.json');
    let recordedRevision = (fs.existsSync(manifestFile) && JSON.parse(fs.readFileSync(manifestFile, 'utf8')).sourceCommit) || deployed[target];
    if (!recordedRevision && fs.existsSync(current) && !force) {
      // A package that never recorded its source is taken as current once; from here on its source is tracked.
      log(`${target}: no recorded source, taking ${revision.slice(0, 12)} as its baseline`);
      recordedRevision = built[target] = revision;
    }
    let from = current;
    if (force || recordedRevision !== revision || !fs.existsSync(current)) {
      log(`${target}: ${dryRun ? 'would build' : 'building'} ${revision.slice(0, 12)}`);
      if (dryRun) { planned++; continue; }
      // Some builds insist on the directory names of their final place.
      from = path.join(cache, 'stage', target, options.output);
      fs.rmSync(from, { recursive: true, force: true });
      build(target, { output: from });
      built[target] = revision;
    }
    const inventory = hashTree(from);
    if (!Object.keys(inventory).length) throw Error('Empty package: ' + target);
    if (inventory['component.json']) {
      const manifest = JSON.parse(fs.readFileSync(path.join(from, 'component.json'), 'utf8'));
      if (manifest.sourceCommit && manifest.sourceCommit !== revision || manifest.sourceDirty) throw Error('Package built from another source: ' + target);
      const listed = manifest.files && !Array.isArray(manifest.files) && Object.values(manifest.files).every(value => typeof value === 'string') ? manifest.files : null;
      if (listed && !sameTree(listed, Object.fromEntries(Object.entries(inventory).filter(([name]) => name !== 'component.json')))) throw Error('Package inventory mismatch: ' + target);
    }
    for (const destination of [current, ...applications.map(application => place(application, options.output))]) {
      if (destination === from || !fs.existsSync(path.dirname(destination))) continue;
      if (fs.existsSync(destination)) {
        if (sameTree(hashTree(destination), inventory)) continue;
        // Builds are not byte-identical, so a copy that differs is replaced only when it is known to
        // come from another source: this run rebuilt the package, or the copy names a different commit.
        const theirs = fs.existsSync(path.join(destination, 'component.json')) && JSON.parse(fs.readFileSync(path.join(destination, 'component.json'), 'utf8')).sourceCommit;
        if (from === current && (!theirs || theirs === revision)) continue;
      }
      swaps.push({ target, from, destination, inventory });
    }
  }
  if (!swaps.length && !planned) log('Every package already matches its source');
  if (dryRun) {
    for (const swap of swaps) log(`${swap.target}: would replace ${swap.destination}`);
    return swaps.map(swap => ({ target: swap.target, destination: swap.destination }));
  }
  // Staged beside the workspace, never inside an application directory.
  const staging = fs.mkdtempSync(path.join(cache, 'swap', 'run-'));
  const done = [];
  try {
    swaps.forEach((swap, index) => {
      swap.incoming = path.join(staging, 'new-' + index);
      swap.previous = path.join(staging, 'old-' + index);
      fs.cpSync(swap.from, swap.incoming, { recursive: true });
      if (!sameTree(hashTree(swap.incoming), swap.inventory)) throw Error('Staged copy differs: ' + swap.target);
    });
    for (const swap of swaps) {
      const existed = fs.existsSync(swap.destination);
      if (existed) fs.renameSync(swap.destination, swap.previous);
      done.push({ swap, existed });
      fs.renameSync(swap.incoming, swap.destination);
      if (!sameTree(hashTree(swap.destination), swap.inventory)) throw Error('Deployed copy differs: ' + swap.destination);
      log(`${swap.target}: ${Object.keys(swap.inventory).length} files verified at ${swap.destination}`);
    }
  } catch (error) {
    for (const { swap, existed } of done.reverse()) {
      if (fs.existsSync(swap.destination) && !fs.existsSync(swap.incoming)) fs.renameSync(swap.destination, swap.incoming);
      if (existed && fs.existsSync(swap.previous)) fs.renameSync(swap.previous, swap.destination);
    }
    throw Error((['EPERM', 'EBUSY', 'EACCES'].includes(error.code) ? 'A package is in use; close QAQ-Revival and the games it started. ' : '') + error.message + '. Nothing was deployed.');
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(path.join(cache, 'stage'), { recursive: true, force: true });
  }
  if (Object.keys(built).length) fs.writeFileSync(stateFile, JSON.stringify({ ...deployed, ...built }, null, 2) + '\n');
  return swaps.map(swap => ({ target: swap.target, destination: swap.destination }));
}

function plainGit(directory, args, { allowed = [0] } = {}) {
  const result = spawnSync('git', ['-c', 'credential.helper=', ...args], { cwd: directory, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  if (result.error || !allowed.includes(result.status)) throw Error('Git ' + args[0] + ' failed: ' + (result.stderr || result.error?.message || '').trim().slice(-600));
  return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() };
}

async function main(argv) {
  const manifest = require('./upstream-repositories.json');
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'run';
  const plan = createPlan(manifest);
  if (command === 'deploy') return void deploy({ targets: argv.slice(1).filter(arg => !arg.startsWith('--')), force: argv.includes('--force'), dryRun: argv.includes('--dry-run'), ...(argv.includes('--no-install') ? { install: null } : {}) });
  if (command === 'tags') {
    for (const node of plan.filter(node => node.kind === 'fork' && node.versionTags && fs.existsSync(path.join(node.directory, '.git')))) fetchVersionTags(plainGit, node.directory, 'origin', node.name);
    return;
  }
  const { createAppClient } = require('./github-app-client.cjs');
  const output = (name, value) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); };
  if (command === 'status') {
    const client = await createAppClient({ permissions: { contents: 'read' } });
    const rows = (await status({ plan, api: client.api, owner: manifest.owner })).filter(row => row.pending.length);
    for (const row of rows) console.log(`${row.path}: ${row.pending.join(', ')}`);
    if (!rows.length) console.log('Everything is up to date');
    output('pending', rows.length ? 'true' : 'false');
    return;
  }
  if (command !== 'run') throw Error('Unknown command: ' + command);
  const client = await createAppClient({ permissions: { contents: 'write', workflows: 'write' } });
  const git = (directory, args, options) => client.git(directory, args, { ...options, skipLfs: true });
  const report = await synchronize({ plan, git, api: client.api, push: !argv.includes('--no-push') });
  const held = report.filter(row => row.held);
  fs.mkdirSync(path.join(root, '.cache/sync'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cache/sync/last-sync.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(root, '.cache/sync/held.md'), held.map(row => `- \`${row.path}\` (${row.name}): ${row.held}`).join('\n') + '\n');
  output('held', held.length ? 'true' : 'false');
  if (argv.includes('--deploy')) deploy();
  if (held.length) process.exitCode = 2;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createPlan, ensureCheckout, synchronize, status, deploy, mergeUpstream, mergeOptional, fetchVersionTags, publishVersionTags, acceptOfficialRuntime, hashTree };
