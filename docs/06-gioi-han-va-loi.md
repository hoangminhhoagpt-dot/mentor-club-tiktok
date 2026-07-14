# Giới hạn của TikTok & bảng tra lỗi

Đọc phần này **trước khi hứa gì với khách**.

---

## Phần 1 — 3 giới hạn không thể lập trình vượt qua

### 1. Đăng video KHÔNG tự lên tường

Video được đẩy vào **hộp thư/nháp** của app TikTok. Chủ kênh phải mở điện thoại, bấm Đăng.

**Vì sao:** TikTok chặn đăng công khai tự động cho tới khi app qua **audit**. Chưa audit mà dùng luồng *Direct Post* thì mọi video bị ép về **SELF_ONLY (riêng tư)** và giới hạn **5 user/24h** — tức là đăng ra cũng chẳng ai xem được.

**Muốn tự động 100%:** phải submit app cho TikTok audit. Nhưng audit **không kiểm tra code — nó kiểm tra giao diện**:
- phải hiện **avatar + nickname** creator trước khi đăng (gọi `creator_info/query`)
- phải có **dropdown chọn quyền riêng tư, không mặc định sẵn**
- phải cho bật/tắt comment, duet, stitch
- phải có **toggle nội dung thương mại** (Your Brand / Branded Content)
- phải hiện **bản xem trước video** + dòng cam kết Music Usage

→ Nghĩa là phải **dựng hẳn một giao diện web**. Một script chạy nền như bộ này **về bản chất không thoả mãn được**. TikTok còn **từ chối thẳng** những app trông giống "công cụ nội bộ / side project". Quy trình mất **2–4 tuần**, nhiều vòng phản hồi.

**Kết luận thực dụng:** tự dùng → giữ luồng hộp thư. Bán cho khách như một sản phẩm thật → mới đáng đi audit.

### 2. Caption không truyền qua API được

Ở luồng hộp thư, TikTok **không nhận caption** từ API. Cột `Caption gợi ý` chỉ để bạn **copy tay** dán vào app.

### 3. Tài khoản cá nhân chỉ có số liệu cơ bản

| Có | Không có |
|---|---|
| view, like, comment, share | thời gian xem trung bình |
| caption, thời lượng, ngày đăng | tỷ lệ xem hết video |
| thumbnail, share/embed url | nguồn hiển thị (feed/search/profile…) |
| follower, tổng like, số video | phân bố quốc gia người xem |

Mấy cột bên phải chỉ có với **tài khoản Business** + TikTok Business API. Bảng 15.1 vẫn tạo sẵn cột đó — nâng cấp sau không phải sửa bảng.

---

## Phần 2 — Bảng tra lỗi

> 🩺 Trước khi tra tay, **chạy cái này** — nó tự dò và chỉ đúng chỗ sai:
> ```bash
> node .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts/check-setup.mjs
> ```

### Lỗi TikTok

| Báo lỗi | Nghĩa thật | Sửa |
|---|---|---|
| `unauthorized_client` / `error_type=client_key` | App chưa cấu hình xong | Add **Login Kit**; đăng ký redirect URI **chính xác**; app sandbox thì thêm tài khoản vào **Target users** (và **chấp nhận lời mời** trong app TikTok) |
| `Code verifier or code challenge is invalid` | PKCE sai | Script đã xử lý (TikTok đòi SHA-256 **hex**, lệch chuẩn RFC 7636). Nếu vẫn gặp → chạy lại `auth` lấy link mới, code cũ hết hạn sau vài phút |
| `scope_not_authorized` | Token thiếu quyền | Bật scope trong app **rồi ủy quyền lại** (bật scope thôi chưa đủ) |
| `access_token_invalid` / `invalid_grant` | Refresh token hỏng/bị thu hồi | Chạy lại `get-tiktok-token.mjs auth` + `exchange` |
| `spam_risk_too_many_pending_share` | Hộp thư đầy | TikTok giới hạn số video pending/ngày — **chờ hôm sau** |
| Không thấy `follower_count` | Thiếu scope `user.info.stats` | Bật scope → ủy quyền lại |
| Content Posting API gọi là lỗi | Chưa thêm product | App TikTok → **Products** → thêm **Content Posting API** |

### Lỗi Lark

| Mã | Nghĩa | Sửa |
|---|---|---|
| `91403` | App không có quyền trên Base | [03-quyen-nang-cao-lark.md](03-quyen-nang-cao-lark.md) |
| `1254302` | Không có quyền trên bảng cụ thể | Vai trò chưa được cấp quyền trên bảng đó |
| `1061004` | Thiếu scope Drive | Bật `drive:drive` + `drive:file` → **phát hành lại app** |
| `1254005` | `table_id` sai | Chạy lại `setup-tables.mjs` |
| `99991663` | Token hết hạn | Script tự xử lý |
| Ảnh/video không lên | Thiếu quyền Drive, hoặc app chưa phát hành | Xem [01-tao-app-lark.md](01-tao-app-lark.md) mục 1.3–1.4 |

### Lỗi GitHub

| Hiện tượng | Sửa |
|---|---|
| Dispatch trả `404` | Sai `<user>/<repo>`, hoặc PAT thiếu scope `repo` |
| Dispatch trả `403` | PAT fine-grained thiếu **Contents: Read and write** → dùng PAT **classic** |
| Trả `204` nhưng **không chạy gì** | Repo fork chưa bật workflow → tab **Actions** → bấm nút bật |
| Workflow đỏ, log ghi "Thiếu cấu hình X" | Quên Secret/Variable → [05-github-secrets.md](05-github-secrets.md) |

---

## Phần 3 — Bảo trì định kỳ

| Việc | Khi nào |
|---|---|
| **Ủy quyền lại TikTok** | **Mỗi 365 ngày** — refresh token hết hạn tính từ ngày ủy quyền, chạy đều cũng **không** được gia hạn. `check-setup.mjs` cảnh báo trước 30 ngày |
| Tạo lại GitHub PAT | Khi PAT hết hạn |
| Đổi App Secret Lark | Nếu nghi lộ |

> Sau khi ủy quyền lại, nhớ **cập nhật Secret `TIKTOK_REFRESH_TOKEN` trên GitHub**, không chỉ sửa file trên máy.
