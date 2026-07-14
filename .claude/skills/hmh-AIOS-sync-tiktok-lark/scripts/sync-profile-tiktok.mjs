#!/usr/bin/env node
/**
 * Kéo PROFILE (thông tin tài khoản) TikTok -> Lark Base bảng "15.3 Profile Tiktok".
 * Lấy: display_name, username, avatar, bio, link profile, tick xanh,
 *      follower / following / tổng like / số video.
 *
 * UPSERT theo open_id -> chạy lại mỗi ngày chỉ CẬP NHẬT số liệu, không tạo dòng trùng.
 * (Muốn lưu lịch sử tăng trưởng theo ngày thì dùng --append: mỗi lần chạy thêm 1 dòng mới.)
 *
 * ⚠ Số liệu follower/like/video CHỈ có nếu app TikTok đã bật scope `user.info.stats`,
 *   bio/username/tick xanh cần `user.info.profile`. Thiếu scope thì script vẫn chạy,
 *   chỉ để trống các cột đó và in cảnh báo (xem docs/02-tao-app-tiktok.md).
 *
 * Chạy: node sync-profile-tiktok.mjs [--dry] [--append] [--refresh-avatar]
 * Node >= 18, zero-dependency.
 */
import {
  loadConfig, requireKeys, num,
  getUserInfo, uploadThumb, listAllRecords, createRecord, updateRecord,
} from "./lib.mjs";

const DRY = process.argv.includes("--dry");
const APPEND = process.argv.includes("--append");
const REFRESH_AVATAR = process.argv.includes("--refresh-avatar");

const CFG = loadConfig();
requireKeys(CFG, ["larkAppId", "larkAppSecret", "appToken", "tableProfile"]);

function mapUser(u) {
  const f = {
    "open_id": String(u.open_id ?? ""),
    "display_name": u.display_name || "",
    "username": u.username || "",
    "bio": u.bio_description || "",
    "profile_url": u.profile_deep_link || "",
    "follower_count": num(u.follower_count),
    "following_count": num(u.following_count),
    "likes_count": num(u.likes_count),
    "video_count": num(u.video_count),
    "Ngày cập nhật": Date.now(),
  };
  if (u.is_verified != null) f["is_verified"] = !!u.is_verified;
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  return f;
}

async function main() {
  const { user, scopes, missing } = await getUserInfo(CFG);
  if (!user.open_id) throw new Error("TikTok không trả về open_id — token hỏng?");

  console.log(`TikTok profile: ${user.display_name || "(không tên)"}${user.username ? ` (@${user.username})` : ""}`);
  console.log(`  scope được cấp: ${scopes}`);
  if (missing.length) {
    console.log(`  ⚠ THIẾU scope: ${missing.join(", ")} → các cột tương ứng sẽ TRỐNG.`);
    if (missing.includes("user.info.stats")) console.log("    (không có follower/like/số video — bật scope user.info.stats rồi ủy quyền lại)");
  }

  const fields = mapUser(user);
  if (DRY) { console.log("\n== DRY RUN — map -> Lark ==\n", JSON.stringify(fields, null, 2)); return; }

  const rows = await listAllRecords(CFG, CFG.tableProfile);
  const cur = APPEND ? null : rows.find((r) => {
    const raw = r.fields["open_id"];
    const id = Array.isArray(raw) ? raw.map((x) => x.text || x).join("") : raw;
    return String(id || "") === String(user.open_id);
  });

  // Avatar: chỉ tải khi dòng chưa có ảnh (hoặc --refresh-avatar). Link avatar TikTok có hạn nên
  // phải upload thật vào Lark, không lưu URL.
  const avatarUrl = user.avatar_large_url || user.avatar_url;
  const hasAvatar = cur?.fields["avatar"]?.length;
  if (avatarUrl && (REFRESH_AVATAR || !hasAvatar)) {
    try {
      const ft = await uploadThumb(CFG, avatarUrl, `avatar-${user.open_id}.jpg`);
      fields["avatar"] = [{ file_token: ft }];
    } catch (e) { console.log(`  ! avatar lỗi: ${e.message}`); }
  }

  if (cur) {
    await updateRecord(CFG, CFG.tableProfile, cur.record_id, fields);
    console.log("\n✔ XONG: cập nhật 1 dòng profile.");
  } else {
    await createRecord(CFG, CFG.tableProfile, fields);
    console.log(`\n✔ XONG: tạo 1 dòng profile${APPEND ? " (chế độ --append: lưu lịch sử theo ngày)" : ""}.`);
  }
  if (user.follower_count != null) {
    console.log(`   follower=${user.follower_count} · like=${user.likes_count} · video=${user.video_count}`);
  }
}
main().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
