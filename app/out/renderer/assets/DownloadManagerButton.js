import { r as React } from './index.js';
export function DownloadManagerButton() {
  const [summary, setSummary] = React.useState({ count: 0, open: false });
  React.useEffect(() => {
    const update = event => setSummary(event.detail);
    window.addEventListener('qaqm:download-summary', update);
    window.dispatchEvent(new CustomEvent('qaqm:request-download-summary'));
    return () => window.removeEventListener('qaqm:download-summary', update);
  }, []);
  return React.createElement('button', { type: 'button', className: 'sidebar-download-button', title: '下载管理', 'aria-label': '下载管理', 'aria-expanded': summary.open,
    onClick: event => { event.stopPropagation(); window.dispatchEvent(new CustomEvent('qaqm:toggle-download-panel')); } },
    React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      React.createElement('path', { d: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4' })),
    summary.count > 0 && React.createElement('span', { className: 'sidebar-download-count' }, summary.count > 99 ? '99+' : summary.count));
}
