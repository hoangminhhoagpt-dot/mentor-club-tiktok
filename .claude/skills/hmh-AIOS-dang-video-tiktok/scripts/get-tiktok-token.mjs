#!/usr/bin/env node
/**
 * hmh-AIOS-dang-video-tiktok — lấy TikTok refresh_token có scope video.upload (chạy 1 lần).
 * Dùng PKCE (Login Kit Desktop bắt buộc; redirectUri kiểu http://localhost:PORT/callback).
 *
 * Bước 1 — in link đăng nhập (tự sinh & lưu code_verifier):
 *   node get-tiktok-token.mjs auth
 *   Mở link, đăng nhập TikTok (đúng tài khoản CẦN ĐĂNG video), đồng ý cấp quyền "Upload video".
 *   Trình duyệt nhảy tới redirectUri?code=XXXX&state=...
 *   (Trang localhost báo "không mở được" là bình thường — chỉ cần chuỗi code trên URL.)
 *
 * Bước 2 — đổi code lấy token (tự lưu refreshToken vào config.local.json):
 *   node get-tiktok-token.mjs exchange "<code>"
 *
 * Cần điền trước trong config.local.json: clientKey, clientSecret, redirectUri.
 * ⚠️ TikTok app phải BẬT sản phẩm "Content Posting API" và scope video.upload thì mới cấp được quyền này.
 */
import { loadConfig, requireKeys, authorizeUrl, exchangeCode, patchConfig, makePkce, FULL_SCOPE } from "./lib.mjs";

const cmd = process.argv[2];
const CFG = loadConfig();
requireKeys(CFG, ["clientKey", "clientSecret", "redirectUri"]);

if (cmd === "auth") {
  const { verifier, challenge } = makePkce();
  patchConfig({ _pkceVerifier: verifier });
  console.log("\nMở link này trong trình duyệt (đăng nhập đúng tài khoản TikTok cần đăng):\n");
  // Xin TRỌN scope (gồm video.upload + video.publish) để 1 token dùng chung cho cả inbox lẫn Direct Post,
  // đồng thời KHÔNG làm mất video.list của skill sync (cùng dùng chung token).
  console.log(authorizeUrl(CFG, { codeChallenge: challenge, scope: FULL_SCOPE }));
  console.log('\nSau khi đồng ý, copy giá trị "code" trong URL redirect rồi chạy:');
  console.log('   node get-tiktok-token.mjs exchange "<code>"\n');
} else if (cmd === "exchange") {
  let code = process.argv[3];
  if (!code) { console.error('Thiếu code. Dùng: node get-tiktok-token.mjs exchange "<code>"'); process.exit(1); }
  if (!CFG._pkceVerifier) { console.error("Thiếu code_verifier — chạy lại 'auth' trước rồi mới 'exchange'."); process.exit(1); }
  code = decodeURIComponent(code).replace(/\*$/, "");
  const j = await exchangeCode(CFG, code, CFG._pkceVerifier);
  if (!j.refresh_token) { console.error("Không nhận được refresh_token:", JSON.stringify(j)); process.exit(1); }
  patchConfig({ refreshToken: j.refresh_token, accessToken: "", _pkceVerifier: "" });
  console.log("✔ Đã lưu refreshToken vào config.local.json");
  console.log(`  open_id: ${j.open_id}`);
  console.log(`  scope  : ${j.scope}   (cần có video.upload; muốn Direct Post cần thêm video.publish)`);
  console.log(`  access_token hết hạn sau ${j.expires_in}s; refresh_token sau ${j.refresh_expires_in}s (~365 ngày).`);
  const sc = String(j.scope || "");
  if (!sc.includes("video.upload"))
    console.log("\n⚠️ Scope KHÔNG có video.upload — vào TikTok for Developers bật Content Posting API + scope video.upload rồi làm lại.");
  if (!sc.includes("video.publish"))
    console.log("\n⚠️ Scope KHÔNG có video.publish — Direct Post (đăng kèm caption) sẽ lỗi. Vào TikTok bật thêm scope video.publish + bấm 'Apply changes' rồi làm lại 'auth'.");
  console.log("\nĐăng thử hộp thư:   node post-video-tiktok.mjs --limit 1");
  console.log("Đăng thử Direct:    node post-video-tiktok.mjs --limit 1 --direct   (app chưa audit → video sẽ ở chế độ riêng tư)");
} else {
  console.log('Dùng: node get-tiktok-token.mjs auth   |   node get-tiktok-token.mjs exchange "<code>"');
  process.exit(1);
}
