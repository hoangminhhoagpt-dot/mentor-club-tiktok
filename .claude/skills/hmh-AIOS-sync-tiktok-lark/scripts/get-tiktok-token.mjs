#!/usr/bin/env node
/**
 * hmh-AIOS-sync-tiktok-lark — lấy TikTok Display API refresh_token (chạy 1 lần).
 * Dùng PKCE (Login Kit Desktop bắt buộc; Web cũng chấp nhận).
 *
 * Bước 1 — in link đăng nhập (tự sinh & lưu code_verifier):
 *   node get-tiktok-token.mjs auth
 *   Mở link, đăng nhập TikTok, đồng ý. Trình duyệt nhảy tới redirectUri?code=XXXX&state=...
 *   (Trang localhost báo "không mở được" là bình thường — chỉ cần chuỗi code trên URL.)
 *
 * Bước 2 — đổi code lấy token (tự lưu refreshToken vào config.local.json):
 *   node get-tiktok-token.mjs exchange "<code>"
 *
 * Cần điền trước trong config.local.json: clientKey, clientSecret, redirectUri
 * (redirectUri phải trùng CHÍNH XÁC cái đăng ký trong Login Kit, vd http://localhost:5173/callback).
 */
import { loadConfig, requireKeys, authorizeUrl, exchangeCode, patchConfig, makePkce } from "./lib.mjs";

const cmd = process.argv[2];
const CFG = loadConfig();
requireKeys(CFG, ["clientKey", "clientSecret", "redirectUri"]);

if (cmd === "auth") {
  const { verifier, challenge } = makePkce();
  patchConfig({ _pkceVerifier: verifier }); // lưu tạm để bước exchange dùng
  console.log("\nMở link này trong trình duyệt (đăng nhập đúng tài khoản TikTok cần kéo):\n");
  console.log(authorizeUrl(CFG, { codeChallenge: challenge }));
  console.log('\nSau khi đồng ý, copy giá trị "code" trong URL redirect rồi chạy:');
  console.log('   node get-tiktok-token.mjs exchange "<code>"\n');
} else if (cmd === "exchange") {
  let code = process.argv[3];
  if (!code) { console.error('Thiếu code. Dùng: node get-tiktok-token.mjs exchange "<code>"'); process.exit(1); }
  if (!CFG._pkceVerifier) { console.error("Thiếu code_verifier — chạy lại 'auth' trước rồi mới 'exchange'."); process.exit(1); }
  code = decodeURIComponent(code).replace(/\*$/, ""); // TikTok đôi khi kèm "*" ở cuối
  const j = await exchangeCode(CFG, code, CFG._pkceVerifier);
  if (!j.refresh_token) { console.error("Không nhận được refresh_token:", JSON.stringify(j)); process.exit(1); }
  patchConfig({ refreshToken: j.refresh_token, accessToken: "", _pkceVerifier: "" });
  console.log("✔ Đã lưu refreshToken vào config.local.json");
  console.log(`  open_id: ${j.open_id}`);
  console.log(`  scope  : ${j.scope}`);
  console.log(`  access_token hết hạn sau ${j.expires_in}s; refresh_token sau ${j.refresh_expires_in}s (~365 ngày).`);
  console.log("\nGiờ chạy đồng bộ: node sync-tiktok-lark.mjs --limit 5");
} else {
  console.log("Dùng: node get-tiktok-token.mjs auth   |   node get-tiktok-token.mjs exchange \"<code>\"");
  process.exit(1);
}
