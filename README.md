# Quản lý code tên custom

Web nhận ID và tên game từ các team, cho ADMIN quản lý custom, xem trực tiếp
PlayerNameOverwrite trên HTML và tải JSON.

## Quy tắc tên

- Tên team và tên game giữ nguyên chữ hoa/thường người dùng nhập.
- Khoảng trắng trong tên game được bỏ khi xuất.
- Ví dụ `STY` + `Tran Thinh` xuất thành `STY.TranThinh`.
- `PlayerNation` lấy đúng tên team.
- `TeamRegion` xuất theo dạng `SCRIM + tên custom`; `Custom At` thành `SCRIM AT`.

## Chạy cục bộ

```bash
npm install
npm run dev
```

Ứng dụng dùng PostgreSQL qua biến môi trường `DATABASE_URL` trên Render và tự
khởi tạo bảng trong lần truy cập đầu tiên.
