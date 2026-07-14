---
name: hmh-AIOS-dang-video-tiktok
description: >
  Đăng/đẩy video lên TikTok TỪ bảng Lark Base "15.2 Đăng video TikTok" — mỗi dòng là 1 video (attachment).
  ĐĂNG THEO NÚT BẤM: người dùng tick ô "Đăng ngay" trên một dòng → Lark Automation gọi HTTP kèm record_id
  → script đăng ĐÚNG dòng đó (không phụ thuộc trạng thái). Dùng Content Posting API luồng "Upload to Inbox"
  (scope video.upload, KHÔNG cần app audit): video vào HỘP THƯ/NHÁP của tài khoản để chủ kênh mở app TikTok
  dán caption và bấm Đăng. Ghi Publish ID + trạng thái ngược lại bảng, tự bỏ tick để không đăng lặp.
  Dùng khi người dùng muốn: đăng video TikTok từ Lark Base, đẩy video lên TikTok từ bảng, dựng bộ đăng TikTok
  cho học viên/khách. KHÔNG dùng để LẤY số liệu video TikTok → đó là hmh-AIOS-sync-tiktok-lark.
  Kích hoạt khi có từ: đăng video tiktok, đăng tiktok từ lark, upload tiktok từ larkbase, bảng đăng video
  tiktok, đẩy video lên tiktok, nút đăng tiktok, tự động đăng tiktok.
---

# Skill: Đăng video TikTok từ Lark Base

Từ bảng Lark chứa video (attachment) → **đẩy lên TikTok** → ghi kết quả về bảng.

> 📦 Bản triển khai GitHub Actions + nút bấm trên Lark: xem `README.md` + `docs/07-lark-automation.md`.

## Cách kích hoạt — NÚT BẤM, không phải trạng thái
- Người dùng tick ô **`Đăng ngay`** trên một dòng bảng 15.2.
- Lark Automation bắt sự kiện đó → gọi HTTP kèm **`record_id`** → script đăng **đúng dòng đó**,
  **bất kể `Trạng thái` là gì**. (`Trạng thái` chỉ là KẾT QUẢ: Đang đẩy / Đã vào hộp thư / Lỗi.)
- Chống trùng: dòng đã có **`Publish ID`** thì bỏ qua (trừ `--force`). Đăng xong (kể cả khi lỗi) script
  **tự bỏ tick** → automation không lặp vô hạn.
- Không truyền `record_id` → quét bảng, đẩy mọi dòng **có tick** và **chưa có Publish ID**.

## ⚠️ Giới hạn của TikTok (không lập trình vượt được)
- Video vào **HỘP THƯ/NHÁP**, **KHÔNG tự lên tường**. Chủ kênh mở app TikTok bấm Đăng.
- **Caption KHÔNG truyền qua API được** ở luồng inbox — cột `Caption gợi ý` chỉ để copy tay.
- Muốn đăng công khai tự động: phải chuyển luồng **Direct Post** (`video.publish`) **và submit app cho
  TikTok audit**. Audit kiểm tra **giao diện** (avatar creator, dropdown quyền riêng tư không mặc định,
  toggle nội dung thương mại, preview video…) → một script chạy nền **không thoả mãn được**.
  Chưa audit mà dùng Direct Post thì video bị ép **SELF_ONLY** + trần 5 user/24h. Xem `docs/06-gioi-han-va-loi.md`.

## Nguồn / chuẩn kỹ thuật
- `POST /v2/post/publish/inbox/video/init/` → `publish_id` + `upload_url`;
  `PUT` bytes theo mảnh (5–64MB, header `Content-Range`); `POST /v2/post/publish/status/fetch/` để poll.
  Scope bắt buộc: **`video.upload`**; app phải thêm product **Content Posting API**.
- OAuth v2 + **PKCE** — ⚠️ TikTok đòi `code_challenge` là **SHA-256 HEX** (lệch chuẩn RFC 7636).
- **Kho token dùng chung:** khoá `tokenFile` trong `config.local.json` trỏ về config của skill sync
  → 1 app TikTok = 1 refresh token, nhiều skill dùng chung, không đá nhau.

## Quy trình
```bash
# Bảng 15.2 do setup-tables.mjs (skill sync) tạo — gồm ô tick "Đăng ngay".
node post-video-tiktok.mjs --dry-run              # xem sẽ đẩy dòng nào
node post-video-tiktok.mjs --record-id recXXX     # đăng đúng 1 dòng (chế độ nút bấm)
node post-video-tiktok.mjs --limit 1              # đẩy 1 dòng có tick
node post-video-tiktok.mjs                        # đẩy hết dòng có tick
```
Cờ: `--record-id` · `--limit N` · `--dry-run` · `--force` (đẩy lại dòng đã có Publish ID)

## Gotcha
- TikTok giới hạn **số video pending trong hộp thư mỗi ngày** → vượt sẽ báo
  `spam_risk_too_many_pending_share`, chờ hôm sau.
- Nhận mp4/mov/webm, < 4GB. File lớn tự chia mảnh 64MB.
- `scope_not_authorized` → bật `video.upload` trong app **rồi ủy quyền lại**.

## Tham chiếu
- `scripts/post-video-tiktok.mjs` — script đăng chính.
- `scripts/lib.mjs` — OAuth + Content Posting API + Lark (download attachment).
- `scripts/get-tiktok-token.mjs` — lấy refresh token (xin trọn scope cho cả 2 chiều).
- Bảng 15.2 tạo bằng `../hmh-AIOS-sync-tiktok-lark/scripts/setup-tables.mjs`.
