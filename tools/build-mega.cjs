const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const upstream = path.join(root, 'vendor/MegaDownloader-Revival');
const isTest = process.argv.includes('--test');
const output = path.join(root, isTest ? 'build/mega-worker-test' : 'app/resources/mega-worker');
const build = path.join(root, 'build/mega-worker');
const framework = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework/v4.0.30319');
const compiler = path.join(framework, 'vbc.exe');
if (!fs.existsSync(path.join(upstream, 'Clases/FileDownloader.vb'))) throw Error('Run git submodule update --init first');
if (!fs.existsSync(compiler)) throw Error('.NET Framework VB compiler is required');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(build, { recursive: true });
const sources = ['FileDownloader', 'Criptografia', 'Conexion', 'PreSharedKeyManager', 'URLExtractor', 'MegaFolderHelper',
  'MegaQuotaManager', 'PathGuard', 'ThrottledStream', 'ThrottledStreamController', 'InternalConfiguration', 'ResourceHelper', 'MEGA_ErrorHandler'];
const libraries = ['BouncyCastle.Cryptography', 'Newtonsoft.Json', 'System.Memory', 'System.Buffers', 'System.Numerics.Vectors', 'System.Runtime.CompilerServices.Unsafe'];
for (const name of libraries) fs.copyFileSync(path.join(upstream, 'Resources/DLLs', name + '.dll'), path.join(output, name + '.dll'));
const args = ['/nologo', '/target:exe', '/optimize+', '/optionstrict+', '/optioninfer+', '/rootnamespace:MegaDownloader', '/main:MegaDownloader.Worker',
  '/imports:Microsoft.VisualBasic,System,System.Collections,System.Collections.Generic,System.Linq,System.Diagnostics',
  `/out:"${path.join(output, 'QAQMMegaWorker.exe')}"`, `/sdkpath:"${framework}"`,
  '/reference:System.dll,System.Core.dll,System.Security.dll,System.Numerics.dll',
  ...libraries.map(name => `/reference:"${path.join(output, name + '.dll')}"`),
  `/resource:"${path.join(upstream, 'Resources/InternalConfig.xml')}",MegaDownloader.InternalConfig.xml`,
  ...sources.filter(name => !isTest || name !== 'InternalConfiguration').map(name => `"${path.join(upstream, 'Clases', name + '.vb')}"`),
  ...(isTest ? [`"${path.join(root, 'bridges/mega/TestConfiguration.vb')}"`] : []),
  `"${path.join(root, 'bridges/mega/Host.vb')}"`, `"${path.join(root, 'bridges/mega/Worker.vb')}"`];
const response = path.join(build, 'compile.rsp');
fs.writeFileSync(response, args.join('\n'));
const result = spawnSync(compiler, ['@' + response], { encoding: 'utf8', windowsHide: true });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.status !== 0) process.exit(result.status || 1);
fs.copyFileSync(path.join(upstream, 'LICENSE'), path.join(output, 'LICENSE-Revival.txt'));
fs.writeFileSync(path.join(output, 'QAQMMegaWorker.exe.config'), '<?xml version="1.0"?><configuration><startup useLegacyV2RuntimeActivationPolicy="true"><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>');
fs.rmSync(path.join(output, 'source.json'), { force: true });
console.log('Built download worker: ' + output);
