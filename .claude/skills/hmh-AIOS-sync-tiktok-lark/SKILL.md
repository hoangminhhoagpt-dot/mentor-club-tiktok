---
name: hmh-AIOS-sync-tiktok-lark
description: >
  Kéo VIDEO và PROFILE của một tài khoản TikTok (cá nhân) về Lark Base qua TikTok Display API.
  Bảng "15.1 Data Tiktok": view, like, comment, share, caption, thời lượng, ngày đăng, share/embed url,
  thumbnail (upload thật thành attachment). Bảng "15.3 Profile Tiktok": follower, following, tổng like,
  số video, avatar, bio, tick xanh. UPSERT theo item_id / open_id nên chạy lại không tạo bản trùng.
  Kèm script TỰ TẠO 3 bảng đúng schema và script kiểm tra cấu hình.
  Dùng khi người dùng muốn: kéo dữ liệu video tiktok về lark base, đồng bộ TikTok vào Larkbase,
  lấy follower/profile TikTok, cập nhật số liệu kênh TikTok.
  Kích hoạt khi có từ: kéo tiktok về lark, sync tiktok lark, dữ liệu video tiktok, profile tiktok,
  follower tiktok, đồng bộ tiktok larkbase, video tiktok vào bảng.
---

# Skill: Đồng bộ TikTok → Lark Base (video + profile)

Gọi **TikTok Display API v2** lấy toàn bộ video + thông tin tài khoản, ghi vào Lark Base theo **upsert**
(video khớp `item_id`, profile khớp `open_id`) — chạy lại chỉ cập nhật, không nhân bản.

> 📦 Bản triển khai GitHub Actions (tự chạy hằng ngày, không cần bật máy): xem `README.md` + `docs/` ở gốc repo.

## ⚠️ Giới hạn (đọc trước kẻo vỡ kỳ vọng)
- Tài khoản **cá nhân** chỉ lấy được **số cơ bản**. Các cột `total_time_watched`, `average_time_watched`,
  `full_video_watched_rate`, `impression_sources_*`, `audience_countries-*`, `view_users` **luôn TRỐNG**
  (chỉ tài khoản **Business** + TikTok Business API mới có).
- **follower / tổng like / số video** cần scope `user.info.stats`; **username / bio / tick xanh** cần
  `user.info.profile`. Thiếu scope → script vẫn chạy, chỉ để trống cột đó và in cảnh báo.

## Nguồn / chuẩn kỹ thuật
- `POST /v2/video/list/` — phân trang `cursor` + `has_more`, trần 20/trang.
- `GET /v2/user/info/?fields=...` — **field cấp theo scope**; xin field ngoài scope là hỏng cả request
  → `lib.mjs` tự dò scope thực tế rồi chỉ xin đúng field được phép.
- OAuth v2 + **PKCE**. ⚠️ **TikTok lệch chuẩn RFC 7636: `code_challenge` phải là SHA-256 dạng HEX**,
  không phải base64url (gửi base64url luôn báo "Code verifier or code challenge is invalid").
- `refresh_token` sống **365 ngày tính từ lúc ủy quyền**, **KHÔNG được gia hạn khi refresh**
  (đã kiểm chứng: TikTok trả lại đúng token cũ, không xoay vòng).
- Lark Bitable Open API: `tenant_access_token`; `records` (list/create/update); `drive/v1/medias/upload_all`
  (`parent_type=bitable_image`) để đưa thumbnail/avatar thành attachment.

## Quy trình
```bash
cd .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts
cp config.example.json config.local.json        # điền larkAppId/Secret, appToken, clientKey/Secret

node setup-tables.mjs                            # tạo 3 bảng (15.1 / 15.2 / 15.3), in ra table_id
node get-tiktok-token.mjs auth                   # mở link, Authorize, copy "code" trên URL redirect
node get-tiktok-token.mjs exchange "<code>"      # tự lưu refreshToken vào config
node check-setup.mjs                             # 🩺 dò 7 mắt xích, chỉ đúng chỗ sai

node sync-profile-tiktok.mjs                     # profile -> 15.3
node sync-tiktok-lark.mjs --limit 5              # thử 5 video -> 15.1
node sync-tiktok-lark.mjs                        # full sync
```
Cờ: `--dry` · `--limit N` · `--refresh-thumbs` · `--config <path>` · (profile: `--append` lưu lịch sử theo ngày)

## Gotcha
- **`setup-tables.mjs` so tên bảng KHÔNG khắt khe** (bỏ qua dấu chấm / khoảng trắng / hoa-thường) — nếu so
  khắt khe thì bảng "15.1. Data Tiktok" người dùng đặt tay sẽ bị coi là chưa có → **tạo bảng trùng**.
  Bảng đã có mà thiếu cột thì script **bổ sung cột**, không đụng cột cũ.
- **Thumbnail/avatar** chỉ upload cho dòng chưa có ảnh (`--refresh-thumbs` để làm mới hết). Link ảnh TikTok
  có hạn → phải upload thật vào Lark, không lưu URL.
- **Display API báo thành công bằng `error.code === "ok"`**, không phải `code === 0` như Lark.
- Lỗi hay gặp: TikTok `scope_not_authorized` → bật scope **rồi ủy quyền lại**; Lark `91403` → app thiếu quyền
  sửa Base (`docs/03-quyen-nang-cao-lark.md`); `1061004` → thiếu scope drive.

## Tham chiếu
- `scripts/lib.mjs` — OAuth + Display API + Lark helpers.
- `scripts/setup-tables.mjs` — tạo / nâng cấp 3 bảng.
- `scripts/check-setup.mjs` — 🩺 kiểm tra cấu hình (chạy đầu tiên khi có lỗi).
- `scripts/get-tiktok-token.mjs` · `scripts/sync-tiktok-lark.mjs` · `scripts/sync-profile-tiktok.mjs`
