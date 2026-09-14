import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type');

  if (!contentType?.toLowerCase().includes('text/html')) return response;

  const html = await response.text();
  const path = context.url.pathname;
  const storeScript = '<script src="/store-ui.js" defer></script>';
  const adminBrandingLink = path.startsWith('/admin') && !path.startsWith('/admin/branding')
    ? '<a href="/admin/branding">Branding</a>'
    : '';
  let output = html;
  if (!output.includes('/store-ui.js')) output = output.replace('</head>', `${storeScript}</head>`);
  if (adminBrandingLink && output.includes('</nav>') && !output.includes('/admin/branding')) {
    output = output.replace('</nav>', `${adminBrandingLink}</nav>`);
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(output, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
