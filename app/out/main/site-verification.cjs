'use strict';

// Read only the visible document state; never answer or alter a site's challenge.
function inspectVerificationDocument() {
  const title = document.title || '';
  const challenge = /just a moment|attention required|checking your browser|security verification/i.test(title) ||
    !!document.querySelector('#challenge-running, #challenge-stage, #cf-challenge-running, #challenge-form');
  return { title, challenge, ready: document.readyState !== 'loading', html: challenge ? '' : document.documentElement.outerHTML.slice(0, 6000000) };
}
function canFinishVerification({ challenge, ready, status } = {}) {
  return !!ready && !challenge && status >= 200 && status < 400;
}
function sameDocument(left, right) {
  try {
    const a = new URL(left), b = new URL(right);
    a.hash = ''; b.hash = '';
    return a.href === b.href;
  } catch { return false; }
}
module.exports = { inspectVerificationDocument, canFinishVerification, sameDocument };
