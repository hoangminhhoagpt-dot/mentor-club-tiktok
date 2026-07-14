# Bước 6 — Nối nút bấm & lịch tự động trong Lark Base

Mục tiêu: người dùng cuối **không cần biết GitHub là gì**. Họ chỉ kéo video vào bảng và **tick một ô**.

⏱ Khoảng 10 phút.

---

## 6.1 Nút "Đăng ngay" — tick là video bay lên TikTok

Bảng **15.2** đã có sẵn cột **`Đăng ngay`** (ô tick). Giờ nối nó với GitHub.

### Tạo Automation

Mở Base → tab **Automation** (Tự động hoá) → **Tạo quy trình mới**.

**Trigger — "Khi bản ghi được cập nhật"**
- Bảng: `15.2 Đăng video TikTok`
- Trường theo dõi: **`Đăng ngay`**
- Điều kiện: `Đăng ngay` **là** ✅ (checked)

**Action — "Gửi yêu cầu HTTP"**

| Ô | Điền |
|---|---|
| **URL** | `https://api.github.com/repos/<user>/<repo>/dispatches` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer ghp_...`<br>`Accept: application/vnd.github+json`<br>`Content-Type: application/json` |
| **Body** | xem dưới |

```json
{
  "event_type": "dang-video-tiktok",
  "client_payload": {
    "record_id": "{{Record ID}}"
  }
}
```

> 🔑 **`record_id` là mấu chốt.** Nó bảo script "đăng ĐÚNG dòng này" — không quan tâm Trạng thái là gì.
> Trong Lark, chèn nó bằng cách bấm nút **`+`** ở ô Body → chọn **ID bản ghi / Record ID**.

Bật quy trình → **xong**.

### Từ giờ người dùng chỉ cần

1. Thêm dòng mới ở bảng 15.2
2. Kéo file `.mp4` vào cột **Video**, gõ **Tiêu đề** + **Caption gợi ý**
3. **Tick ô `Đăng ngay`** ✅

Khoảng 30–60 giây sau, bảng tự cập nhật `Trạng thái = Đã vào hộp thư` + `Publish ID`, và **ô tick tự bỏ** (để không đăng lặp).

4. Mở app TikTok → thông báo/nháp → dán caption → **Đăng**.

> Nếu lỗi: `Trạng thái = Lỗi` và cột **`Ghi chú lỗi`** ghi rõ nguyên nhân — không phải đi mò log GitHub.

---

## 6.2 Nút "Cập nhật số liệu" — bấm là kéo dữ liệu về

Cách nhanh nhất: thêm cột **Nút bấm** (Button) vào bảng 15.1, hoặc dùng một ô tick tương tự.

**Trigger:** khi ô tick `Làm mới` = ✅ (hoặc bấm Button)
**Action:** Gửi yêu cầu HTTP — y hệt trên, chỉ đổi Body:

```json
{ "event_type": "sync-tiktok" }
```

Kéo cả **profile (15.3)** lẫn **video (15.1)** trong một lần chạy.

---

## 6.3 Lịch tự động — đã có sẵn, khỏi làm gì

Workflow `sync-tiktok` **đã tự chạy 08:00 mỗi sáng**. Không cần đụng vào Lark.

Muốn Lark chủ động gọi theo lịch riêng (vd 3 lần/ngày): Automation → trigger **"Theo lịch"** → action HTTP với body `{"event_type":"sync-tiktok"}`.

> GitHub cron tối thiểu ~5 phút/lần và **có thể trễ**. Cần đúng phút → dùng lịch của Lark thay vì cron GitHub.

---

## 6.4 Một repo — nhiều khách / nhiều Base

Không cần copy code. Truyền thẳng id của khách trong `client_payload`:

```json
{
  "event_type": "sync-tiktok",
  "client_payload": {
    "base_id": "bascnKhachA...",
    "table_tiktok": "tblAAA",
    "table_profile": "tblBBB"
  }
}
```

Giá trị trong `client_payload` **ghi đè** Variables mặc định. Bí mật (`LARK_APP_SECRET`, token TikTok) **vẫn phải nằm ở Secrets** — mỗi khách một repo, hoặc mỗi khách một bộ Secrets riêng.

---

## ❗ Lỗi hay gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| Tick ô mà không có gì xảy ra | Automation chưa **Bật**, hoặc điều kiện trigger sai |
| Actions chạy nhưng báo "Không thấy dòng recXXX" | `{{Record ID}}` chưa được chèn đúng → Body gửi đi là chuỗi literal, không phải id thật |
| Đăng đi đăng lại một video | Script bỏ tick sau khi đăng; nếu vẫn lặp → kiểm tra Automation có trigger cả khi **script** cập nhật dòng không (đặt điều kiện `Đăng ngay = ✅` là đủ chặn) |
| `Dòng ... đã đăng rồi` | Dòng đó đã có `Publish ID`. Muốn đẩy lại: xoá ô `Publish ID` rồi tick lại |

---

➡️ Còn vướng gì: [06-gioi-han-va-loi.md](06-gioi-han-va-loi.md)
