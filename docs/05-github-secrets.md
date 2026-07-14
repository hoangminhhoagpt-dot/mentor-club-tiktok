# Bước 5 — Nạp Secrets & Variables lên GitHub

Sau bước này, hệ thống chạy trên cloud: **máy bạn tắt vẫn chạy**.

⏱ Khoảng 5 phút.

---

## 5.1 Nguyên tắc: cái gì Secret, cái gì Variable

| | **Secrets** (che kín, không xem lại được) | **Variables** (đọc được, tiện sửa) |
|---|---|---|
| Là gì | mật khẩu, token | id, tên bảng, domain |
| Lộ ra thì | 💀 người khác chiếm được tài khoản | 🤷 không sao |

Vào repo → **Settings** → **Secrets and variables** → **Actions**.

## 5.2 Tab **Secrets** → New repository secret (3 cái)

| Tên | Lấy ở đâu |
|---|---|
| `LARK_APP_SECRET` | bước 1.2 |
| `TIKTOK_CLIENT_SECRET` | bước 2.5 |
| `TIKTOK_REFRESH_TOKEN` | trong `config.local.json` sau bước 4.3 |

## 5.3 Tab **Variables** → New repository variable (6 cái)

| Tên | Giá trị |
|---|---|
| `LARK_APP_ID` | `cli_...` (bước 1.2) |
| `LARK_DOMAIN` | `https://open.larksuite.com` (Feishu: `https://open.feishu.cn`) |
| `LARK_BASE_ID` | bước 1.6 |
| `TABLE_TIKTOK` | id bảng 15.1 (bước 4.2) |
| `TABLE_POST` | id bảng 15.2 (bước 4.2) |
| `TABLE_PROFILE` | id bảng 15.3 (bước 4.2) |
| `TIKTOK_CLIENT_KEY` | `aw...` / `sbaw...` (bước 2.5) |

---

## 5.4 Chạy thử trên GitHub

Vào tab **Actions** → chọn **sync-tiktok** → **Run workflow** → **Run**.

Xanh ✅ = xong. Đỏ ❌ → bấm vào xem log, dòng lỗi nói rõ thiếu gì.

Từ giờ workflow **tự chạy 08:00 mỗi sáng** (cron `0 1 * * *` giờ UTC).

> ⏰ Cron của GitHub chạy theo **UTC** và **có thể trễ vài phút** khi hệ thống bận — bình thường, không phải lỗi.
> Muốn đổi giờ: sửa dòng `cron` trong `.github/workflows/sync-tiktok.yml` (giờ VN = giờ UTC + 7).

---

## 5.5 Tạo GitHub PAT (để gọi từ Lark Base)

Cần cái này thì Lark mới "bấm nút" gọi GitHub được.

1. **https://github.com/settings/tokens** → **Generate new token (classic)**.
2. Scope: tick **`repo`**.
3. Hạn dùng: chọn theo nhu cầu (hết hạn thì tạo lại, không phải sửa code).
4. Copy token (`ghp_...`) — **chỉ hiện đúng 1 lần**.

> ⚠️ PAT = chìa khoá vào repo của bạn. Đừng dán lên chat/nhóm/screenshot. Lỡ lộ → vào link trên **Revoke** ngay rồi tạo cái mới.

Thử xem PAT có chạy không:

```bash
curl -i -X POST https://api.github.com/repos/<user>/<repo>/dispatches \
  -H "Authorization: Bearer ghp_..." \
  -H "Accept: application/vnd.github+json" \
  -d '{"event_type":"sync-tiktok"}'
```

Trả về **`HTTP/2 204`** = thành công (204 nghĩa là "đã nhận, không có gì trả về" — đúng như mong đợi).
Vào tab **Actions** sẽ thấy một lần chạy mới vừa xuất hiện.

---

## ❗ Lỗi hay gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| `404 Not Found` khi dispatch | Sai tên user/repo, hoặc PAT không có scope `repo` |
| `403` | PAT dạng *fine-grained* thiếu quyền **Contents: Read and write** → dùng **classic** cho nhanh |
| Dispatch trả **204** nhưng Actions **không chạy gì** | Repo là **bản fork** và chưa bật workflow → vào tab **Actions** bấm **"I understand my workflows, go ahead and enable them"** |
| Workflow chạy nhưng lỗi "Thiếu cấu hình ..." | Quên một Variable/Secret ở 5.2–5.3 |

---

➡️ Tiếp: [07-lark-automation.md](07-lark-automation.md) — nối nút bấm trong Lark Base
