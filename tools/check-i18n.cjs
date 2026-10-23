'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const localeRoot = path.join(root, 'app/src/shared/i18n/locales');
const han = /\p{Script=Han}/u;
const displayProperties = new Set([
  'children', 'label', 'title', 'subtitle', 'description', 'desc', 'placeholder',
  'text', 'message', 'error', 'detail', 'notice', 'hint', 'tooltip', 'emptyText',
  'buttons', 'buttonLabel', 'cancelLabel', 'confirmLabel', 'alt', 'importError', 'aria-label', 'aria-description', 'aria-roledescription'
]);
const displayCalls = /^(?:alert|confirm|prompt|notify|toast|showToast|showErrorBox|showMessageBox(?:Sync)?|showOpenDialog(?:Sync)?|showSaveDialog(?:Sync)?|set(?:[A-Z][a-zA-Z]*)?(?:Error|Notice|Message|Toast|Status|StatusText|LoadingText|Hint|Result|Stage|Announcement))$/;

function propertyName(node) {
  return node?.type === 'Identifier' || node?.type === 'JSXIdentifier' ? node.name : node?.value;
}

function callName(node) {
  return node?.type === 'Identifier' ? node.name : propertyName(node?.property);
}

function errorTarget(node) {
  const errorName = name => /^(?:(?:state|settings|storage|load|save|request|operation)Error|errorMessage|warningMessage)$/.test(name || '');
  if (node?.type === 'Identifier') return errorName(node.name) ? node.name : null;
  if (node?.type !== 'MemberExpression') return null;
  const field = propertyName(node.property);
  const ownerField = propertyName(node.object?.property);
  return errorName(field) || ['error', 'warning'].includes(field) || ['errors', 'warnings'].includes(ownerField) ? field : null;
}

function isTranslationCall(nodePath) {
  const node = nodePath.node;
  if (node?.type !== 'CallExpression' && node?.type !== 'OptionalCallExpression') return false;
  if (node.callee.type !== 'Identifier') return callName(node.callee) === 't' && /^(?:i18n|translator)$/.test(node.callee.object?.name || '');
  const binding = nodePath.scope.getBinding(node.callee.name);
  if (binding?.path.isImportSpecifier()) return propertyName(binding.path.node.imported) === 't' && /i18n/.test(binding.path.parent.source.value);
  if (node.callee.name !== 't') return false;
  return !binding || binding.path.isVariableDeclarator();
}

// Follow only display expressions. Comparisons, paths, regular expressions,
// console output, and data names are allowed to contain Chinese.
function displayContext(literalPath, seen = new Set()) {
  if (literalPath.findParent(parent => {
    if (!parent.isCallExpression()) return false;
    const name = callName(parent.node.callee) || '';
    const owner = parent.node.callee?.object?.name || '';
    return /^(?:setLogs|appendLog|addLog|logMessage)$/.test(name) || /^(?:console|logger|logs)$/.test(owner);
  })) return null;
  let current = literalPath;
  while (current.parentPath) {
    const parent = current.parentPath;
    if (parent.isAssignmentExpression()) {
      const field = current.key === 'right' && errorTarget(parent.node.left);
      return field ? `assignment:${field}` : null;
    }
    if (parent.isObjectProperty()) {
      if (current.key === 'key') return null;
      const field = propertyName(parent.node.key);
      const container = parent.parentPath;
      if (field === 'modName' && container.node.properties.some(item => propertyName(item.key) === 'managedInstall' && item.value?.value === true)) return 'managed-install-name';
      if (field === 'text' && container.isObjectExpression() && container.node.properties.some(item => propertyName(item.key) === 'type' && item.value?.value === 'text')) return null;
      if (container.parentPath?.isCallExpression() && isTranslationCall(container.parentPath) && container.listKey === 'arguments' && container.key === 1) return `interpolation:${field}`;
      if (field === 'name' && parent.findParent(ancestor => ancestor.isCallExpression() && /^show(?:Open|Save)Dialog/.test(callName(ancestor.node.callee) || ''))) return 'dialog-filter';
      return displayProperties.has(field) ? `property:${field}` : null;
    }
    if (parent.isArrayExpression() && typeof current.key === 'number' && parent.parentPath?.isArrayExpression()) {
      const outer = parent.parentPath;
      const field = outer.parentPath;
      if (field?.isObjectProperty() && propertyName(field.node.key) === 'items' && field.parentPath.node.properties.some(item => displayProperties.has(propertyName(item.key)))) return 'option-label';
      const references = field?.isVariableDeclarator() && field.node.id.type === 'Identifier' ? field.scope.getBinding(field.node.id.name)?.referencePaths || [] : [outer];
      for (const reference of references) {
        const member = reference.parentPath;
        const call = member?.isMemberExpression() && member.parentPath;
        if (!call || !call.isCallExpression() || call.node.callee !== member.node || !['map', 'forEach'].includes(propertyName(member.node.property))) continue;
        const callback = call.get('arguments')[0];
        const parameter = callback?.node.params?.[0];
        const identifier = parameter?.type === 'ArrayPattern' && parameter.elements[current.key];
        if (identifier?.type !== 'Identifier') continue;
        const binding = callback.scope.getBinding(identifier.name);
        if (binding && !seen.has(binding)) {
          seen.add(binding);
          if (binding.referencePaths.some(item => displayContext(item, seen))) return 'option-label';
        }
      }
    }
    if (parent.isJSXAttribute()) {
      const field = propertyName(parent.node.name);
      return displayProperties.has(field) ? `attribute:${field}` : null;
    }
    if ((parent.isJSXElement() || parent.isJSXFragment()) && current.listKey === 'children') return 'jsx';
    if (parent.isBinaryExpression() && parent.node.operator !== '+') return null;
    if (parent.isConditionalExpression() && current.key === 'test') return null;
    if (parent.isLogicalExpression() && parent.node.operator === '&&' && current.key === 'left') return null;
    if (parent.isCallExpression() || parent.isOptionalCallExpression() || parent.isNewExpression()) {
      const name = callName(parent.node.callee);
      if (isTranslationCall(parent)) return null;
      if (name === 'Error' && current.listKey === 'arguments' && current.key === 0) return 'error';
      if (name === 'probeWritableDirectory' && current.listKey === 'arguments' && current.key === 1) return 'directory-label';
      if (displayCalls.test(name || '')) return `call:${name}`;
      if ((name === 'h' || name === 'createElement') && current.listKey === 'arguments' && current.key >= 2) return 'element';
      if (parent.node.callee?.object?.name === 'toast') return 'toast';
      if (parent.node.callee?.type === 'Identifier' && current.listKey === 'arguments') {
        const binding = parent.scope.getBinding(name);
        const fn = binding?.path.isFunctionDeclaration() ? binding.path : binding?.path.get('init');
        const parameter = fn?.isFunction() && fn.node.params[current.key];
        if (parameter?.type === 'Identifier') {
          const parameterBinding = fn.scope.getBinding(parameter.name);
          if (parameterBinding && !seen.has(parameterBinding)) {
            seen.add(parameterBinding);
            for (const reference of parameterBinding.referencePaths) {
              const context = displayContext(reference, seen);
              if (context) return `argument:${name}.${parameter.name}`;
            }
          }
        }
      }
      return null;
    }
    if (parent.isVariableDeclarator() && parent.node.id.type === 'Identifier') {
      const field = errorTarget(parent.node.id);
      if (field) return `variable:${field}`;
      const binding = parent.scope.getBinding(parent.node.id.name);
      if (binding && !seen.has(binding)) {
        seen.add(binding);
        for (const reference of binding.referencePaths) {
          const context = displayContext(reference, seen);
          if (context) return context;
        }
      }
      return null;
    }
    if (parent.isReturnStatement()) {
      const fn = parent.getFunctionParent();
      const name = fn?.node.id?.name || fn?.parentPath?.node.id?.name || '';
      return /(?:Label|Title|Message|Hint|Text|Description)$/i.test(name) ? `return:${name}` : null;
    }
    if (parent.isFunction() || parent.isStatement()) return null;
    current = parent;
  }
  return null;
}

function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string') result[name] = item;
    else if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, name, result);
    else throw Error(`Invalid translation value: ${name}`);
  }
  return result;
}

function readLocales(directory = localeRoot) {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const domains = {};
    for (const filename of fs.readdirSync(path.join(directory, entry.name)).filter(file => file.endsWith('.json'))) {
      domains[path.basename(filename, '.json')] = JSON.parse(fs.readFileSync(path.join(directory, entry.name, filename), 'utf8'));
    }
    return [entry.name, flatten(domains)];
  }));
}

function placeholders(text) {
  return [...new Set([...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(match => match[1]))].sort();
}

function validateLocales(locales) {
  const issues = [];
  const chinese = locales['zh-CN'] || {};
  for (const [language, entries] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(entries)) {
      const issue = message => issues.push({ file: `locales/${language}`, key, message });
      if (!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(key) || key.split('.').some(part => /^\d+$/.test(part) || /^[a-f0-9]{12,}$/.test(part))) issue('Use a semantic resource key');
      if (!value.trim()) issue('Translation is empty');
      if (placeholders(value).some(name => !/^[a-z][a-zA-Z0-9_]*(?:\.[a-z][a-zA-Z0-9_]*)*$/.test(name) || /^(?:arg|value|param)\d+$/.test(name))) issue('Use named interpolation');
      if (language === 'zh-CN') continue;
      if (!(key in chinese)) issue('Missing default-language resource');
      else if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(chinese[key]))) issue('Interpolation differs from the default language');
      if (language === 'en' && han.test(value)) issue('Untranslated Chinese in English resource');
    }
  }
  return issues;
}

function inspectSource(source, filename = 'source.js', translations = {}) {
  const ast = parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, plugins: ['jsx'] });
  const issues = [];
  function report(node, message, extra = {}) {
    issues.push({ file: filename, line: node.loc.start.line, column: node.loc.start.column + 1, message, ...extra });
  }
  function literal(nodePath) {
    const node = nodePath.node;
    const text = node.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.cooked || part.value.raw).join('…') : node.value;
    if (!han.test(text)) return;
    if (nodePath.isJSXText()) { if (text.trim()) report(node, 'UI text must use a resource key', { text: text.trim(), context: 'jsx' }); return; }
    const context = displayContext(nodePath);
    if (context) report(node, 'UI text must use a resource key', { text, context, start: node.start, end: node.end });
  }
  traverse(ast, {
    StringLiteral: literal,
    TemplateLiteral: literal,
    JSXText: literal,
    CallExpression(nodePath) {
      const node = nodePath.node;
      if (!isTranslationCall(nodePath)) return;
      const key = node.arguments[0];
      if (key?.type === 'StringLiteral') {
        if (han.test(key.value)) report(key, 'Chinese text cannot be a resource key');
        else if (!(key.value in translations)) report(key, 'Unknown resource key', { key: key.value });
        else {
          const options = node.arguments[1];
          if (!options || (options.type === 'ObjectExpression' && !options.properties.some(item => item.type === 'SpreadElement'))) {
            const fields = new Set(options?.properties.map(item => propertyName(item.key)) || []);
            const missing = placeholders(translations[key.value]).filter(name => !fields.has(name.split('.')[0]));
            if (missing.length) report(node, `Missing interpolation: ${missing.join(', ')}`, { key: key.value });
          }
        }
      }
      const options = node.arguments[1];
      if (options?.type === 'ObjectExpression' && options.properties.some(item => propertyName(item.key) === 'defaultValue')) report(options, 'Put fallback text in the default-language resource');
    }
  });
  return issues;
}

function inspectMarkup(source, filename) {
  const issues = [];
  const masked = source.replace(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1>/gi, match => match.replace(/[^\n]/g, ' '));
  const pattern = /(?:\b(?:title|placeholder|aria-label)\s*=\s*['"]([^'"]*)['"])|(?:>([^<>]+)<)|(?:\bcontent\s*:\s*['"]([^'"]*)['"])/g;
  for (const match of masked.matchAll(pattern)) {
    const text = match[1] || match[2] || match[3];
    if (han.test(text)) issues.push({ file: filename, line: masked.slice(0, match.index).split('\n').length, message: 'UI text must use a resource key', text: text.trim() });
  }
  return issues;
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.name.startsWith('.')) return [];
    if (entry.isDirectory()) return filename === path.join(root, 'app/src/shared/i18n') ? [] : sourceFiles(filename);
    return /\.(?:[cm]?js|jsx|html|css)$/.test(entry.name) ? [filename] : [];
  });
}

function run(args = process.argv.slice(2)) {
  const locales = readLocales();
  const issues = validateLocales(locales);
  if (!args.includes('--resources-only')) {
    const explicit = args.filter(arg => !arg.startsWith('--'));
    const files = explicit.length ? explicit.map(file => path.resolve(file)) : sourceFiles(path.join(root, 'app/src'));
    for (const filename of files) {
      const relative = path.relative(root, filename).split(path.sep).join('/');
      const source = fs.readFileSync(filename, 'utf8');
      try { issues.push(...(/\.(?:html|css)$/.test(filename) ? inspectMarkup(source, relative) : inspectSource(source, relative, locales['zh-CN']))); }
      catch (error) { issues.push({ file: relative, message: error.message }); }
    }
  }
  if (args.includes('--json')) process.stdout.write(JSON.stringify(issues, null, 2) + '\n');
  else {
    for (const issue of issues) console.error(`${issue.file}${issue.line ? `:${issue.line}:${issue.column || 1}` : ''}: ${issue.message}${issue.key ? ` (${issue.key})` : ''}${issue.text ? `: ${JSON.stringify(issue.text)}` : ''}`);
    console.log(issues.length ? `${issues.length} i18n issue(s)` : 'i18n checks passed');
  }
  return issues.length ? 1 : 0;
}

if (require.main === module) process.exitCode = run();
module.exports = { inspectSource, inspectMarkup, displayContext, flatten, readLocales, placeholders, validateLocales, sourceFiles, run };
