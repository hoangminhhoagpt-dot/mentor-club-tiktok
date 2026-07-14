# Bước 3 — Base bật "Quyền nâng cao" (Advanced Permissions)

Đây là cái bẫy khó chịu nhất khi triển khai cho khách doanh nghiệp. Đọc mất 3 phút, tiết kiệm cả buổi.

---

## Triệu chứng

Bạn đã làm đúng hết: app có scope, đã phát hành, đã thêm làm cộng tác viên "Có thể chỉnh sửa"…
**nhưng script vẫn báo:**

```
Lark .../records lỗi: 91403 Forbidden
```

hoặc `check-setup.mjs` dừng ở:

```
[4] Lark — quyền SỬA
  ✗ app KHÔNG ghi được: ... 91403 ...
```

## Vì sao

Khi Base bật **Quyền nâng cao**, danh sách "cộng tác viên" thông thường **bị vô hiệu**. Quyền lúc này do **VAI TRÒ (Roles)** quyết định. App của bạn không thuộc vai trò nào → không có quyền gì, dù bạn đã mời nó vào Base.

## Cách kiểm tra Base có bật hay không

Mở Base → **`•••`** (góc trên phải) → **Quyền nâng cao** / **Advanced Permissions**.
Thấy công tắc đang **BẬT** → bạn đang dính đúng trường hợp này.

---

## Cách sửa (2 lựa chọn)

### Cách A — Thêm app vào một vai trò có quyền sửa (khuyên dùng)

1. Mở Base → **`•••`** → **Quyền nâng cao**.
2. Chọn một vai trò có quyền **Chỉnh sửa** (hoặc bấm **Thêm vai trò** → đặt tên `Bot đồng bộ`).
3. Trong vai trò đó, phần **Thành viên** → **Thêm** → gõ **tên app Lark** của bạn → chọn.
4. Đảm bảo vai trò này có quyền:
   - **Xem + Thêm + Sửa bản ghi** trên cả 3 bảng (15.1, 15.2, 15.3)
   - Quyền **quản lý trường** nếu bạn muốn chạy `setup-tables.mjs` để tự tạo bảng
5. Lưu.

### Cách B — Tắt Quyền nâng cao

Chỉ làm nếu Base không chứa dữ liệu nhạy cảm và bạn hiểu hệ quả: mọi cộng tác viên sẽ quay về quyền phẳng như cũ.

---

## Kiểm tra lại

```bash
node .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts/check-setup.mjs
```

Mục **[4] Lark — quyền SỬA** phải ✔ (script tạo thử 1 dòng rồi xoá ngay để chứng minh ghi được).

---

## Lỗi quyền Lark — tra nhanh

| Mã | Nghĩa | Sửa |
|---|---|---|
| `91403` | app không có quyền trên Base | thêm app vào vai trò có quyền sửa (Cách A) |
| `1254302` | không có quyền trên bảng cụ thể | vai trò chưa được cấp quyền trên bảng đó |
| `1061004` | thiếu scope Drive | bật `drive:drive` + `drive:file`, rồi **phát hành lại app** |
| `99991663` | token hết hạn | script tự xử lý, không cần làm gì |
| `1254005` | `table_id` sai | chạy lại `setup-tables.mjs` để lấy id đúng |

---

➡️ Tiếp: [04-tao-bang-va-token.md](04-tao-bang-va-token.md)
