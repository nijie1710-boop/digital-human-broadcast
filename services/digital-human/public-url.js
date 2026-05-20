export function toPublicUrl(value) {
  const input = String(value || '').trim();
  if (!input) {
    throw new Error('缺少可访问的文件 URL');
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (input.startsWith('/uploads/') || input.startsWith('/samples/')) {
    const baseUrl = String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('当前文件不是公网 URL，请配置 PUBLIC_BASE_URL 或使用 ngrok / Cloudflare Tunnel。');
    }

    assertPublicBaseUrl(baseUrl);
    return `${baseUrl}${input}`;
  }

  throw new Error('当前文件不是公网 URL，请配置 PUBLIC_BASE_URL 或使用 ngrok / Cloudflare Tunnel。');
}

function assertPublicBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
      throw new Error();
    }
  } catch {
    throw new Error('PUBLIC_BASE_URL 必须是公网可访问地址，请使用 ngrok / Cloudflare Tunnel 或部署到服务器。');
  }
}
