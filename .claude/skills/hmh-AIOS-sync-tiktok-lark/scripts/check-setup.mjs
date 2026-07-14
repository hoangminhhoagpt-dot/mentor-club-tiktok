#!/usr/bin/env node
/**
 * KIỂM TRA CẤU HÌNH trước khi chạy thật (chạy cái này ĐẦU TIÊN khi có lỗi).
 * Dò từng mắt xích và nói RÕ phải sửa ở đâu — thay vì để script chính chết giữa chừng.
 *
 *   1. Lark: app id/secret có đúng không
 *   2. Lark: app có quyền ĐỌC Base không (Base id đúng? đã thêm app làm cộng tác viên?)
 *   3. Lark: app có quyền SỬA không (đây là chỗ "Quyền nâng cao" hay chặn)
 *   4. Lark: 2 bảng tồn tại và đủ cột
 *   5. TikTok: refresh token còn sống, còn hạn bao lâu
 *   6. TikTok: scope có đủ video.list (kéo về) và video.upload (đăng lên)
 *   7. TikTok: Content Posting API đã bật chưa
 *
 * Chạy: node check-setup.mjs
 */
import { loadConfig, larkApi, larkToken, refreshAccessToken, TT_OPEN } from "./lib.mjs";

const CFG = loadConfig();
let fail = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m, fix) => { fail++; console.log(`  ✗ ${m}`); if (fix) console.log(`    → ${fix}`); };

console.log("\n═══ KIỂM TRA CẤU HÌNH TIKTOK ⇄ LARK ═══\n");

// ---------- LARK ----------
console.log("[1] Lark — app id/secret");
if (!CFG.larkAppId || !CFG.larkAppSecret) {
  bad("thiếu LARK_APP_ID / LARK_APP_SECRET", "xem docs/01-tao-app-lark.md");
} else {
  try { await larkToken(CFG); ok(`app ${CFG.larkAppId} lấy được tenant_access_token`); }
  catch (e) { bad(`không lấy được token: ${e.message}`, "sai App ID hoặc App Secret — copy lại ở Lark Developer Console"); }
}

console.log("\n[2] Lark — quyền ĐỌC Base");
let tables = [];
if (!CFG.appToken) {
  bad("thiếu LARK_BASE_ID", "lấy trong URL Base: .../base/<LARK_BASE_ID>?table=...");
} else if (fail === 0) {
  try {
    const d = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables?page_size=100`);
    tables = d.items || [];
    ok(`đọc được Base (${tables.length} bảng)`);
  } catch (e) {
    bad(`không đọc được Base: ${e.message}`,
      "Base ID sai, HOẶC chưa thêm app làm cộng tác viên. Mở Base → '...' → Thêm cộng tác viên → tìm tên app → 'Có thể chỉnh sửa'.");
  }
}

console.log("\n[3] Lark — 3 bảng TikTok");
const norm = (s) => String(s || "").toLowerCase().replace(/[.\s]+/g, " ").trim();
const findTable = (id, name) =>
  tables.find((t) => t.table_id === id) || tables.find((t) => norm(t.name) === norm(name));
const t151 = findTable(CFG.tableTiktok,  "15.1 Data Tiktok");
const t152 = findTable(CFG.tablePost,    "15.2 Đăng video TikTok");
const t153 = findTable(CFG.tableProfile, "15.3 Profile Tiktok");
const report = (t, label, cfgId, envName) => {
  if (!t) return bad(`chưa có bảng ${label}`, "chạy: node setup-tables.mjs");
  ok(`${label} → ${t.table_id}${cfgId === t.table_id ? "" : `  (⚠ ${envName} đang trỏ chỗ khác!)`}`);
};
report(t151, "15.1 Data Tiktok",       CFG.tableTiktok,  "TABLE_TIKTOK");
report(t152, "15.2 Đăng video TikTok", CFG.tablePost,    "TABLE_POST");
report(t153, "15.3 Profile Tiktok",    CFG.tableProfile, "TABLE_PROFILE");

console.log("\n[4] Lark — quyền SỬA (chỗ 'Quyền nâng cao' hay chặn)");
if (t151) {
  try {
    // Thử tạo 1 dòng rỗng rồi xoá ngay — cách duy nhất chắc chắn biết app có quyền GHI.
    const rec = await larkApi(CFG, "POST", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${t151.table_id}/records`, { fields: {} });
    await larkApi(CFG, "DELETE", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${t151.table_id}/records/${rec.record.record_id}`);
    ok("app GHI được vào bảng (đã tạo thử 1 dòng rồi xoá)");
  } catch (e) {
    bad(`app KHÔNG ghi được: ${e.message}`,
      "Base đang bật 'Quyền nâng cao' → phải thêm app vào một VAI TRÒ có quyền sửa, chứ không chỉ thêm cộng tác viên. Xem docs/03-quyen-nang-cao-lark.md");
  }
}

// ---------- TIKTOK ----------
console.log("\n[5] TikTok — refresh token");
let scopes = "";
if (!CFG.clientKey || !CFG.clientSecret) {
  bad("thiếu TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET", "xem docs/02-tao-app-tiktok.md");
} else if (!CFG.refreshToken) {
  bad("thiếu TIKTOK_REFRESH_TOKEN", "chạy: node get-tiktok-token.mjs auth  → rồi  exchange \"<code>\"");
} else {
  try {
    const j = await refreshAccessToken(CFG);
    const days = Math.round((j.refresh_expires_in || 0) / 86400);
    scopes = j.scope || "";
    ok(`token còn sống — hết hạn sau ~${days} ngày (${new Date(Date.now() + (j.refresh_expires_in || 0) * 1000).toLocaleDateString("vi-VN")})`);
    if (days < 30) console.log("    ⚠ SẮP HẾT HẠN — chạy lại get-tiktok-token.mjs để ủy quyền mới.");
  } catch (e) {
    bad(`token chết: ${e.message}`, "ủy quyền lại: node get-tiktok-token.mjs auth");
  }
}

console.log("\n[6] TikTok — scope");
if (scopes) {
  console.log(`  (scope hiện có: ${scopes})`);
  scopes.includes("video.list")   ? ok("video.list — kéo dữ liệu về được")
                                  : bad("thiếu video.list", "bật scope trong app TikTok rồi ủy quyền lại");
  scopes.includes("video.upload") ? ok("video.upload — đăng video lên được")
                                  : bad("thiếu video.upload", "bật scope + thêm sản phẩm Content Posting API, rồi ủy quyền lại");
}

console.log("\n[7] TikTok — Content Posting API đã bật chưa");
if (scopes.includes("video.upload")) {
  try {
    const at = (await refreshAccessToken(CFG)).access_token;
    const r = await fetch(`${TT_OPEN}/v2/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: 1048576, chunk_size: 1048576, total_chunk_count: 1 } }),
    });
    const j = await r.json();
    // Chỉ XIN upload_url để dò quyền — không đẩy byte nào nên không có video nào xuất hiện.
    if (j.data?.upload_url) ok("Content Posting API hoạt động (đẩy video được)");
    else bad(`chưa dùng được: ${j.error?.code} — ${j.error?.message || ""}`,
      "vào app TikTok → Products → thêm 'Content Posting API'");
  } catch (e) { bad(`lỗi gọi thử: ${e.message}`); }
}

console.log(fail === 0
  ? "\n═══ TẤT CẢ ĐỀU ỔN — chạy thật được rồi. ═══\n"
  : `\n═══ CÒN ${fail} VẤN ĐỀ — sửa theo mũi tên → ở trên. ═══\n`);
process.exit(fail === 0 ? 0 : 1);
