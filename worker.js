/**
 * Worker proxy cho Trạm Kiểm Định Liên Kết.
 * Giữ ANTHROPIC_API_KEY phía server, cho phép trang GitHub Pages gọi vào an toàn.
 *
 * CÁCH DÙNG (xem hướng dẫn đầy đủ trong tin nhắn chat):
 * 1. Deploy file này lên Cloudflare Workers (dash.cloudflare.com -> Workers & Pages -> Create).
 * 2. Vào Settings -> Variables and Secrets, thêm:
 *    - ANTHROPIC_API_KEY  (Secret)  = khóa API thật lấy từ console.anthropic.com
 *    - ALLOWED_ORIGIN     (Text)    = https://logue24.github.io  (origin trang của bạn)
 *    - MODEL              (Text, tùy chọn) = claude-sonnet-5  (bỏ trống sẽ dùng mặc định)
 * 3. Copy URL Worker (dạng https://ten-worker.ten-subdomain.workers.dev)
 * 4. Dán URL đó vào biến API_ENDPOINT trong file index.html
 */

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Chỉ chấp nhận phương thức POST' }, 405, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Worker chưa được cấu hình ANTHROPIC_API_KEY. Vào Settings -> Variables and Secrets để thêm.' }, 500, cors);
    }

    let bodyText;
    try {
      bodyText = await request.text();
    } catch (e) {
      return json({ error: 'Không đọc được nội dung yêu cầu gửi lên' }, 400, cors);
    }

    // Ép model về một model thật, hợp lệ trên API công khai — trang chính vẫn
    // có thể giữ nguyên tên model dùng cho bản xem trong Claude.ai mà không cần sửa.
    try {
      const parsed = JSON.parse(bodyText);
      parsed.model = env.MODEL || 'claude-sonnet-5';
      bodyText = JSON.stringify(parsed);
    } catch (e) {
      // Nếu không parse được, chuyển tiếp nguyên văn và để Anthropic API tự báo lỗi
    }

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: bodyText,
      });

      const upstreamText = await upstream.text();
      return new Response(upstreamText, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e) {
      return json({ error: 'Không gọi được Anthropic API: ' + e.message }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
