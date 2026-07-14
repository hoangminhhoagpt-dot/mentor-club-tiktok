# Bước 1 — Tạo app Lark và cho nó quyền vào Base

App Lark là "tài khoản robot" để script đọc/ghi Base thay bạn. Không có nó thì mọi thứ dừng ở đây.

⏱ Khoảng 10 phút.

---

## 1.1 Tạo app

1. Mở **https://open.larksuite.com/app** (nếu dùng Feishu bản Trung Quốc thì là `open.feishu.cn`).
2. Bấm **Create Custom App** (Tạo ứng dụng tùy chỉnh).
3. Điền:
   - **App name**: `TikTok Lark Sync` (đặt gì cũng được, miễn bạn nhận ra)
   - **Description**: `Đồng bộ TikTok và Lark Base`
   - **App icon**: tải sẵn tại 👉 [`assets/app-icon-1024.png`](../assets/app-icon-1024.png) (1024×1024, đúng chuẩn)
4. Bấm **Create**.

## 1.2 Lấy App ID và App Secret

Vào tab **Credentials & Basic Info**, copy 2 giá trị:

| Giá trị | Trông như | Dùng làm |
|---|---|---|
| **App ID** | `cli_a1b2c3d4e5f6...` | `LARK_APP_ID` (không bí mật) |
| **App Secret** | chuỗi 32 ký tự | `LARK_APP_SECRET` (**BÍ MẬT**) |

> ⚠️ App Secret giống mật khẩu. Đừng chụp màn hình gửi ai, đừng commit lên Git.

## 1.3 Bật quyền (Scopes)

Vào tab **Permissions & Scopes**, tìm và bật **đủ 4 quyền** sau:

| Scope | Vì sao cần |
|---|---|
| `bitable:app` | đọc/ghi bảng trong Base |
| `bitable:app:readonly` | đọc cấu trúc bảng |
| `drive:drive` | tải video từ Lark, upload thumbnail/avatar lên Lark |
| `drive:file` | thao tác file đính kèm |

> Thiếu `drive:*` → lỗi `1061004`, thumbnail và video sẽ không hoạt động.

## 1.4 Phát hành app (BẮT BUỘC — hay bị quên nhất)

1. Vào tab **Version Management & Release** → **Create a version**.
2. Điền version (vd `1.0.0`) → **Submit for release**.
3. Nếu bạn là admin workspace: vào **Lark Admin Console → App Management** → **duyệt**.

> App chưa phát hành thì `tenant_access_token` vẫn lấy được nhưng **gọi Base sẽ trượt quyền**. Đây là lỗi phổ biến số 1.

## 1.5 Thêm app vào Base (BẮT BUỘC)

App có quyền rồi vẫn chưa đủ — phải mời nó vào **đúng cái Base** đó:

1. Mở Base cần dùng.
2. Góc trên bên phải → nút **`•••`** → **Thêm cộng tác viên** (Add collaborators).
3. Gõ **tên app** bạn vừa tạo (không phải tên bạn) → chọn nó.
4. Cấp quyền **"Có thể chỉnh sửa"** (Can edit) — *không phải* "Có thể xem".

> Nếu Base bật **Quyền nâng cao (Advanced Permissions)** thì bước này **chưa đủ** → đọc tiếp [03-quyen-nang-cao-lark.md](03-quyen-nang-cao-lark.md).

## 1.6 Lấy Base ID

Nhìn thanh địa chỉ khi mở Base:

```
https://xxx.larksuite.com/base/ZM8qbz78JaR16Es560sly6Bkgvg?table=tbl5WU7vPVu57svZ&view=vew...
                               └────────── LARK_BASE_ID ──────────┘
```

Phần sau `/base/` chính là **`LARK_BASE_ID`** (còn gọi là `app_token`).

---

## ✅ Kiểm tra trước khi đi tiếp

```bash
node .claude/skills/hmh-AIOS-sync-tiktok-lark/scripts/check-setup.mjs
```

Mục **[1]**, **[2]** và **[4]** phải ✔. Nếu **[4] app KHÔNG ghi được** → xem [03-quyen-nang-cao-lark.md](03-quyen-nang-cao-lark.md).

➡️ Tiếp: [02-tao-app-tiktok.md](02-tao-app-tiktok.md)
