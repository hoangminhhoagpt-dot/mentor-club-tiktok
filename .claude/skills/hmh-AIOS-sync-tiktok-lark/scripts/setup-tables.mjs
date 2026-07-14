#!/usr/bin/env node
/**
 * Tạo SẴN 2 bảng TikTok trong một Lark Base bất kỳ (chạy 1 lần cho mỗi khách):
 *   - "15.1 Data Tiktok"      : nơi đổ số liệu video kéo về  (sync-tiktok-lark.mjs)
 *   - "15.2 Đăng video TikTok": nơi bỏ video chờ đăng lên TikTok (post-video-tiktok.mjs)
 *
 * Idempotent: bảng đã tồn tại (trùng tên) thì BỎ QUA, không tạo trùng.
 * In ra table_id để dán vào GitHub Variables / config.
 *
 * Chạy:  node setup-tables.mjs
 * Cần:   LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_ID (hoặc điền config.local.json)
 * Node >= 18, zero-dependency.
 */
import { loadConfig, requireKeys, larkApi } from "./lib.mjs";

const CFG = loadConfig();
requireKeys(CFG, ["larkAppId", "larkAppSecret", "appToken"]);

// Mã kiểu trường Lark Bitable: 1=Text 2=Number 3=SingleSelect 5=DateTime 17=Attachment 20=Formula
const N = (formatter) => ({ type: 2, property: { formatter } });
const INT = N("0");
const RATE = N("0.0000");
const SEC3 = N("0.000");

// ---- Bảng 15.1: Data Tiktok --------------------------------------------------
// Cột watch-time / impression / audience CHỈ có dữ liệu với TikTok Business API.
// Tài khoản cá nhân (Display API) sẽ để trống — vẫn tạo cột để sau này nâng cấp không phải sửa bảng.
const T151_NAME = "15.1 Data Tiktok";
const T151_FIELDS = [
  { field_name: "item_id", type: 1 },
  { field_name: "video_create_time", type: 5, property: { date_formatter: "yyyy/MM/dd", auto_fill: false } },
  // "Tháng" là cột CÔNG THỨC -> tạo sau, khi đã biết field_id của video_create_time.
  { field_name: "thumbnail", type: 17 },
  { field_name: "caption", type: 1 },
  { field_name: "likes", ...INT },
  { field_name: "shares", ...INT },
  { field_name: "comments", ...INT },
  { field_name: "video_views", ...INT },
  { field_name: "view_users", ...INT },
  { field_name: "video_duration", ...INT },
  { field_name: "total_time_watched", ...SEC3 },
  { field_name: "average_time_watched", ...SEC3 },
  { field_name: "full_video_watched_rate", ...RATE },
  { field_name: "embed_url", type: 1 },
  { field_name: "share_url", type: 1 },
  { field_name: "impression_sources_follow", ...RATE },
  { field_name: "impression_sources_feed", ...RATE },
  { field_name: "impression_sources_tag", ...RATE },
  { field_name: "impression_sources_profile", ...RATE },
  { field_name: "impression_sources_sound", ...RATE },
  { field_name: "impression_sources_search", ...RATE },
  { field_name: "audience_countries-CA", ...RATE },
  { field_name: "audience_countries-GB", ...RATE },
  { field_name: "audience_countries-NL", ...RATE },
  { field_name: "audience_countries-PR", ...RATE },
  { field_name: "audience_countries-US", ...RATE },
  { field_name: "audience_countries-VE", ...RATE },
];

// ---- Bảng 15.2: Đăng video TikTok -------------------------------------------
// ĐĂNG THEO NÚT BẤM: người dùng tick ô "Đăng ngay" -> Lark Automation gọi GitHub kèm record_id
// -> script đăng ĐÚNG dòng đó (không cần đặt Trạng thái gì cả). "Trạng thái" chỉ là KẾT QUẢ.
const T152_NAME = "15.2 Đăng video TikTok";
const T152_FIELDS = [
  { field_name: "Tiêu đề", type: 1 },
  { field_name: "Video", type: 17 },
  { field_name: "Caption gợi ý", type: 1 },
  { field_name: "Đăng ngay", type: 7 },          // ô tick = NÚT BẤM kích hoạt automation
  { field_name: "Trạng thái", type: 3, property: { options: [
    { name: "Chưa đăng", color: 0 },
    { name: "Đang đẩy", color: 1 },
    { name: "Đã vào hộp thư", color: 2 },
    { name: "Lỗi", color: 3 },
  ] } },
  { field_name: "Trạng thái TikTok", type: 1 },
  { field_name: "Publish ID", type: 1 },
  { field_name: "Ngày đẩy", type: 5, property: { date_formatter: "yyyy/MM/dd HH:mm", auto_fill: false } },
  { field_name: "Ghi chú lỗi", type: 1 },
];

// ---- Bảng 15.3: Profile Tiktok ----------------------------------------------
// UPSERT theo open_id. follower/like/video CHỈ có nếu app bật scope user.info.stats;
// username/bio/tick xanh cần user.info.profile. Thiếu scope -> cột để trống.
const T153_NAME = "15.3 Profile Tiktok";
const T153_FIELDS = [
  { field_name: "open_id", type: 1 },
  { field_name: "display_name", type: 1 },
  { field_name: "username", type: 1 },
  { field_name: "avatar", type: 17 },
  { field_name: "bio", type: 1 },
  { field_name: "profile_url", type: 1 },
  { field_name: "is_verified", type: 7 },
  { field_name: "follower_count", ...INT },
  { field_name: "following_count", ...INT },
  { field_name: "likes_count", ...INT },
  { field_name: "video_count", ...INT },
  { field_name: "Ngày cập nhật", type: 5, property: { date_formatter: "yyyy/MM/dd HH:mm", auto_fill: false } },
];

async function listTables() {
  const out = []; let pt = null;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (pt) qs.set("page_token", pt);
    const d = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables?${qs}`);
    out.push(...(d.items || [])); pt = d.has_more ? d.page_token : null;
  } while (pt);
  return out;
}

/**
 * So tên bảng KHÔNG khắt khe: bỏ qua khác biệt dấu chấm, khoảng trắng thừa, hoa/thường.
 * Nhờ vậy "15.1. Data Tiktok" (bảng người dùng đặt tay) vẫn khớp "15.1 Data Tiktok"
 * — nếu so khắt khe, script sẽ tưởng chưa có và TẠO BẢNG TRÙNG.
 */
const norm = (s) => String(s || "").toLowerCase().replace(/[.\s]+/g, " ").trim();

/**
 * Tạo bảng nếu chưa có. Nếu ĐÃ CÓ thì BỔ SUNG cột còn thiếu (đường nâng cấp cho bảng cũ —
 * vd bảng 15.2 đời đầu chưa có ô tick "Đăng ngay"). Không đụng vào cột đã tồn tại.
 */
async function ensureTable(name, fields, existing) {
  const hit = existing.find((t) => norm(t.name) === norm(name));
  if (!hit) {
    const d = await larkApi(CFG, "POST", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables`, {
      table: { name, default_view_name: "Bảng", fields },
    });
    console.log(`✔ Đã tạo "${name}" → table_id=${d.table_id}`);
    return { table_id: d.table_id, created: true };
  }

  const d = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${hit.table_id}/fields?page_size=100`);
  const have = new Set((d.items || []).map((f) => f.field_name));
  const missing = fields.filter((f) => !have.has(f.field_name));

  if (!missing.length) {
    console.log(`• "${name}" đã có sẵn, đủ cột → bỏ qua. table_id=${hit.table_id}`);
  } else {
    console.log(`• "${name}" đã có sẵn nhưng THIẾU ${missing.length} cột → đang bổ sung...`);
    for (const f of missing) {
      try {
        await larkApi(CFG, "POST", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${hit.table_id}/fields`, f);
        console.log(`    + thêm cột "${f.field_name}"`);
      } catch (e) {
        console.log(`    ! không thêm được "${f.field_name}": ${e.message}`);
      }
    }
  }
  return { table_id: hit.table_id, created: false };
}

/** Cột công thức "Tháng" = MONTH(video_create_time)/YEAR(video_create_time). */
async function addThangFormula(tableId) {
  const d = await larkApi(CFG, "GET", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${tableId}/fields?page_size=100`);
  const fields = d.items || [];
  if (fields.some((f) => f.field_name === "Tháng")) { console.log('  • cột "Tháng" đã có → bỏ qua.'); return; }
  const dt = fields.find((f) => f.field_name === "video_create_time");
  if (!dt) { console.log('  ! không thấy cột video_create_time → bỏ qua cột "Tháng".'); return; }
  const ref = `bitable::$table[${tableId}].$field[${dt.field_id}]`;
  try {
    await larkApi(CFG, "POST", `/open-apis/bitable/v1/apps/${CFG.appToken}/tables/${tableId}/fields`, {
      field_name: "Tháng", type: 20,
      property: { formula_expression: `MONTH(${ref})&"/"&YEAR(${ref})` },
    });
    console.log('  ✔ đã thêm cột công thức "Tháng".');
  } catch (e) {
    // Không chặn: bảng vẫn dùng được, chỉ thiếu cột gom nhóm theo tháng.
    console.log(`  ! không tạo được cột "Tháng" (${e.message}). Tự thêm tay nếu cần: MONTH(video_create_time)&"/"&YEAR(video_create_time)`);
  }
}

async function main() {
  console.log(`Base: ${CFG.appToken}\n`);
  const existing = await listTables();

  const t151 = await ensureTable(T151_NAME, T151_FIELDS, existing);
  if (t151.created) await addThangFormula(t151.table_id);

  const t152 = await ensureTable(T152_NAME, T152_FIELDS, existing);
  const t153 = await ensureTable(T153_NAME, T153_FIELDS, existing);

  console.log(`
──────────────── DÁN 3 GIÁ TRỊ NÀY VÀO CẤU HÌNH ────────────────
  TABLE_TIKTOK  (15.1 Data Tiktok)       = ${t151.table_id}
  TABLE_POST    (15.2 Đăng video TikTok) = ${t152.table_id}
  TABLE_PROFILE (15.3 Profile Tiktok)    = ${t153.table_id}

  • GitHub  : Settings → Secrets and variables → Actions → Variables
  • Chạy máy: điền vào scripts/config.local.json (tableTiktok / tablePost / tableProfile)
────────────────────────────────────────────────────────────────`);
}

main().catch((e) => {
  console.error("LỖI:", e.message);
  if (/91403|1254302|permission|Forbidden/i.test(e.message)) {
    console.error(`
→ App Lark chưa có quyền SỬA trên Base này. Sửa: mở Base → nút "..." (góc trên phải)
  → "Thêm cộng tác viên" → tìm đúng TÊN APP → cấp quyền "Có thể chỉnh sửa".
  Nếu Base bật "Quyền nâng cao" (Advanced permission) thì phải thêm app vào vai trò có quyền sửa.
  Xem docs/03-quyen-nang-cao-lark.md`);
  }
  process.exit(1);
});
