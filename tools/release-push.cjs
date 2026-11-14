const { releaseNames } = require('./package-release.cjs');

// Called only for pushes to the primary QAQR repository. Component forks keep
// their own tag policies. Inspect the committed files, never an uncommitted version.
function releasePushArguments(args, git) {
  if (args[0] !== 'push' || args[1] !== 'origin' || args.includes('--delete') || args.includes('-d')) return args;
  const refs = args.slice(2).filter(arg => !arg.startsWith('-'));
  let main = refs.find(ref => /^(?:[^:]+:)?(?:refs\/heads\/)?main$/.test(ref));
  if (!main && (refs.length === 0 || refs.length === 1 && refs[0] === 'HEAD')) {
    if (args.some(arg => ['--tags', '--all', '--mirror'].includes(arg))) return args;
    if (git(['branch', '--show-current']).stdout !== 'main') return args;
    main = 'HEAD:refs/heads/main';
  }
  if (!main) return args;
  const source = main.split(':')[0];
  const commit = git(['rev-parse', '--verify', `${source}^{commit}`]).stdout;
  const subject = git(['show', '-s', '--format=%s', commit]).stdout;
  if (!subject.startsWith('[P] ')) return args;
  const manifest = file => JSON.parse(git(['show', `${commit}:${file}`]).stdout);
  const version = manifest('app/package.json').version;
  const { tag } = releaseNames(version);
  if (subject !== `[P] Release ${tag}.`) throw Error('Use the release commit subject: [P] Release ' + tag + '.');
  for (const file of ['package.json', 'package-lock.json', 'app/package-lock.json']) {
    const data = manifest(file);
    if (data.version !== version || file.endsWith('lock.json') && data.packages?.['']?.version !== version) {
      throw Error('Release versions differ in ' + file);
    }
  }
  if (args.includes('--no-atomic')) throw Error('Release branches and tags must be pushed atomically');
  const tagRef = 'refs/tags/' + tag;
  const remote = new Map(git(['ls-remote', 'origin', tagRef, tagRef + '^{}']).stdout.split(/\r?\n/).filter(Boolean).map(line => {
    const [object, ref] = line.split(/\s+/); return [ref, object];
  }));
  const remoteObject = remote.get(tagRef);
  const remoteCommit = remote.get(tagRef + '^{}') || remoteObject;
  if (remoteCommit === commit) return args;
  const mainLease = args.map(arg => /^--force-with-lease=(?:refs\/heads\/)?main:([0-9a-f]{40})$/.exec(arg)?.[1]).find(Boolean);
  if (remoteObject && (!mainLease || mainLease !== remoteCommit)) throw Error('Release tag already points to another commit: ' + tag);
  const local = git(['rev-parse', '-q', '--verify', tagRef], { allowed: [0, 1, 128] });
  if (local.status === 0 && local.stdout !== commit && local.stdout !== remoteObject) throw Error('Local release tag conflicts: ' + tag);
  if (!args.includes('--dry-run') && !args.includes('-n')) {
    git(['update-ref', tagRef, commit, local.status === 0 ? local.stdout : '0'.repeat(40)]);
  }
  const result = ['push', 'origin', '--atomic', ...args.slice(2)];
  if (refs.length === 0) result.push(main);
  if (remoteObject) result.push(`--force-with-lease=${tagRef}:${remoteObject}`);
  result.push(`${commit}:${tagRef}`);
  return result;
}

module.exports = { releasePushArguments };
