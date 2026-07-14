# Bước 4 — Tạo 3 bảng tự động + lấy refresh token

⏱ Khoảng 5 phút. Cần **Node ≥ 18** (`node -v` để kiểm tra).

---

## 4.1 Điền cấu hình

```bash
cd .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts
cp config.example.json config.local.json
```

Mở `config.local.json`, điền 5 giá trị đã lấy ở bước 1–2:

```jsonc
{
  "larkAppId":     "cli_...",          // bước 1.2
  "larkAppSecret": "...",              // bước 1.2
  "appToken":      "...",              // bước 1.6 (Base ID)
  "clientKey":     "aw... / sbaw...",  // bước 2.5
  "clientSecret":  "..."               // bước 2.5
}
```

> `config.local.json` đã nằm trong `.gitignore` — **không bao giờ** bị commit lên Git.

---

## 4.2 Tạo 3 bảng — script làm hết

```bash
node setup-tables.mjs
```

Script tự tạo **đúng schema**, và **bỏ qua** bảng đã tồn tại (chạy lại không sợ trùng):

| Bảng | Nội dung |
|---|---|
| **15.1 Data Tiktok** | 28 cột số liệu video + thumbnail + cột công thức `Tháng` |
| **15.2 Đăng video TikTok** | Tiêu đề · Video · Caption gợi ý · **☑ Đăng ngay** · Trạng thái · Publish ID · Ngày đẩy · Ghi chú lỗi |
| **15.3 Profile Tiktok** | follower · following · tổng like · số video · avatar · bio · tick xanh |

Cuối cùng nó in ra **3 id** — copy lại, lát nữa dán vào GitHub:

```
TABLE_TIKTOK  (15.1 Data Tiktok)       = tblXXXXXXXX
TABLE_POST    (15.2 Đăng video TikTok) = tblXXXXXXXX
TABLE_PROFILE (15.3 Profile Tiktok)    = tblXXXXXXXX
```

Dán luôn 3 id này vào `config.local.json` (`tableTiktok`, `tablePost`, `tableProfile`) để chạy được trên máy.

> 💥 Báo lỗi `91403` → app chưa có quyền sửa Base → quay lại [03-quyen-nang-cao-lark.md](03-quyen-nang-cao-lark.md).

---

## 4.3 Ủy quyền TikTok (làm 1 lần, dùng ~1 năm)

**Bước 1 — sinh link:**

```bash
node get-tiktok-token.mjs auth
```

**Bước 2 — mở link đó bằng trình duyệt đang đăng nhập ĐÚNG tài khoản TikTok** cần dùng → bấm **Authorize**.

Trình duyệt sẽ nhảy sang `http://localhost:5173/callback?code=...` và báo **"không kết nối được"**.
→ **Đây là bình thường**, đừng hoảng. Không có server nào chạy ở đó cả. Thứ ta cần nằm trên **thanh địa chỉ**.

**Bước 3 — copy giá trị `code` trên thanh địa chỉ** rồi:

```bash
node get-tiktok-token.mjs exchange "<dán code vào đây>"
```

Script tự lưu `refreshToken` vào `config.local.json` và in ra:

```
✔ Đã lưu refreshToken vào config.local.json
  scope  : user.info.basic,user.info.profile,user.info.stats,video.list,video.upload
```

> 👀 **Nhìn kỹ dòng `scope`.** Thiếu `user.info.stats` → sẽ không có follower. Thiếu `video.upload` → không đăng được video. Thiếu cái nào thì quay lại bật scope trong app TikTok (bước 2.3) rồi **chạy lại `auth` + `exchange`**.
>
> ⏳ `code` chỉ sống vài phút — làm liền tay, đừng để lâu.

---

## 4.4 Kiểm tra toàn bộ

```bash
node check-setup.mjs
```

Phải thấy **7/7 mục ✔**. Nếu còn ✗, script chỉ thẳng chỗ sai bằng mũi tên `→`.

---

## 4.5 Chạy thử thật

```bash
node sync-profile-tiktok.mjs                 # profile -> bảng 15.3
node sync-tiktok-lark.mjs --limit 5          # 5 video -> bảng 15.1 (thử trước cho nhanh)
node sync-tiktok-lark.mjs                    # toàn bộ video
```

Mở Lark Base xem kết quả. Chạy lại lệnh lần nữa → số record **không tăng**, chỉ cập nhật (upsert).

---

## ⏰ Hạn của token — đánh dấu lịch

`refresh_token` sống **365 ngày kể từ ngày ủy quyền**, và **KHÔNG được gia hạn** dù bạn chạy mỗi ngày.
Hết hạn → chạy lại `auth` + `exchange` (mục 4.3), rồi cập nhật lại Secret `TIKTOK_REFRESH_TOKEN` trên GitHub.

`check-setup.mjs` sẽ cảnh báo khi còn dưới 30 ngày.

---

➡️ Tiếp: [05-github-secrets.md](05-github-secrets.md)
