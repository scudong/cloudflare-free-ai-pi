/**
 * Cloudflare Pages 镜像（Advanced Mode）：把所有请求原样转发到正式 Worker。
 *
 * workers.dev 在大陆被 DNS 污染（解析到假 IP，请求黑洞）；pages.dev 实测直连可达。
 * 本 Pages Function 与 Worker 同在 Cloudflare 边缘网络内互访，不经过用户侧 DNS，
 * 不受污染影响。用户访问本项目的 pages.dev 地址即可。
 * 方案来自 pdf-rearch 的 mirror-pages（已在线上运行验证）。
 */

const UPSTREAM = 'https://cloudflare-free-ai-pi.dongchangyang.workers.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upstream = new Request(UPSTREAM + url.pathname + url.search, request);
    const res = await fetch(upstream);

    // 上游若返回绝对 Location（指向 workers.dev），把 origin 换回镜像域名，
    // 避免用户被跳回被污染的域名。
    const location = res.headers.get('location');
    if (location && location.startsWith(UPSTREAM)) {
      const headers = new Headers(res.headers);
      headers.set('location', url.origin + location.slice(UPSTREAM.length));
      return new Response(res.body, { status: res.status, headers });
    }
    return res;
  },
};
