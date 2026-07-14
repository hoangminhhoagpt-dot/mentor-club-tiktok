# Bước 2 — Tạo app TikTok

App TikTok là thứ cho phép script đọc số liệu video và đẩy video lên tài khoản của bạn.

⏱ Khoảng 15 phút.

---

## 📥 Icon app — tải sẵn, khỏi phải đi kiếm

TikTok bắt buộc có **icon 1024×1024 px**. Tải sẵn ở đây:

### 👉 [**TẢI ICON 1024×1024**](../assets/app-icon-1024.png)

<p align="center"><img src="../assets/app-icon-1024.png" width="180"></p>

> Muốn đổi tên thương hiệu cho khách khác: sửa chữ trong [`assets/app-icon.source.html`](../assets/app-icon.source.html) rồi chụp lại bằng Chrome:
> ```bash
> chrome --headless --screenshot=assets/app-icon-1024.png --window-size=1024,1024 assets/app-icon.source.html
> ```
>
> ⚠️ **Đừng dùng logo nốt nhạc của TikTok làm icon** — TikTok cấm bên thứ ba dùng nhãn hiệu của họ và sẽ từ chối app. Icon kèm sẵn ở trên đã tránh chuyện đó.

---

## 2.1 Tạo app

1. Mở **https://developers.tiktok.com** → đăng nhập → **Manage apps** → **Connect an app**.
2. Điền tên app, mô tả, và **upload icon 1024×1024** vừa tải.
3. Bấm **Create**.

## 2.2 Thêm 2 sản phẩm (Products)

Trong app, mục **Products** → **Add products**, thêm **cả hai**:

| Product | Để làm gì | Không có thì |
|---|---|---|
| **Login Kit** | đăng nhập / ủy quyền | không lấy được token → *unauthorized_client* |
| **Content Posting API** | đẩy video lên TikTok | không đăng được video (bảng 15.2 vô dụng) |

## 2.3 Bật Scopes

Vào **Scopes** → **Add scopes**, bật đủ:

| Scope | Cho cái gì | Thiếu thì |
|---|---|---|
| `user.info.basic` | tên, avatar, open_id | không có gì cả |
| `user.info.profile` | username, bio, tick xanh | 15.3 trống các cột đó |
| `user.info.stats` | **follower, tổng like, số video** | 15.3 **không có follower** |
| `video.list` | số liệu video | 15.1 trống |
| `video.upload` | đẩy video vào hộp thư | không đăng được |

> Nhiều người bỏ sót `user.info.stats` rồi thắc mắc "sao không thấy follower". Bật đủ 5 cái ngay từ đầu cho đỡ phải ủy quyền lại.

## 2.4 Đăng ký Redirect URI

1. Trong **Login Kit** → bật **Configure for Desktop**.
2. Thêm **Redirect URI** — gõ **chính xác từng ký tự**:

```
http://localhost:5173/callback
```

> Vì sao phải là Desktop? Vì bản **Web** bắt buộc HTTPS + xác minh domain — `localhost` sẽ bị từ chối.
> Thừa dấu `/` ở cuối, hay đổi `http`→`https`, hay đổi cổng → **đều trượt**.

## 2.5 Lấy Client key / Client secret

Trong tab **Credentials**:

| Giá trị | Trông như | Dùng làm |
|---|---|---|
| **Client key** | `aw...` (thật) hoặc `sbaw...` (sandbox) | `TIKTOK_CLIENT_KEY` (không bí mật) |
| **Client secret** | chuỗi 32 ký tự | `TIKTOK_CLIENT_SECRET` (**BÍ MẬT**) |

---

## 2.6 Sandbox hay Production?

**Key bắt đầu bằng `sbaw...` = app SANDBOX.**

| | Sandbox | Production |
|---|---|---|
| Dùng được ngay | ✅ | phải submit, chờ duyệt |
| Đọc/đăng được cho ai | **chỉ tài khoản trong Target users** | mọi người ủy quyền |
| Hợp để | thử nghiệm, tự dùng | bàn giao khách |

Nếu dùng sandbox: vào app → **Sandbox → Target users** → thêm đúng tài khoản TikTok bạn định dùng. TikTok gửi lời mời — **phải mở app TikTok bấm chấp nhận**, không thì vẫn lỗi `unauthorized_client`.

---

## ❗ Lỗi thường gặp ngay tại bước này

| Hiện tượng | Nguyên nhân thật |
|---|---|
| URL trả về `error=unauthorized_client&error_type=client_key` | Chưa Add **Login Kit**, hoặc chưa đăng ký Redirect URI, hoặc app sandbox mà tài khoản chưa nằm trong Target users |
| `Code verifier or code challenge is invalid` | Lỗi PKCE — **script này đã xử lý rồi** (TikTok đòi SHA-256 dạng **hex**, lệch chuẩn RFC). Nếu vẫn gặp, chạy lại `auth` để lấy link mới |
| `scope_not_authorized` | Bật scope trong app rồi nhưng **chưa ủy quyền lại** — phải chạy lại `get-tiktok-token.mjs auth` |

---

➡️ Tiếp: [03-quyen-nang-cao-lark.md](03-quyen-nang-cao-lark.md) (nếu Base bật quyền nâng cao) hoặc [04-tao-bang-va-token.md](04-tao-bang-va-token.md)
