# LauPhim cho Windows và web

Hai cách mở cùng một website:

- Web: https://tikivn7-pixel.github.io/Web_Phim/Frontend/index.html
- Windows: mở `dist-desktop/LauPhim-1.0.1-x64.exe`. Đây là bản portable, không cần cài Node.js hoặc chạy server. Có thể di chuyển file này sang thư mục khác hoặc máy Windows x64 khác.

Ứng dụng mở website thật trong cửa sổ riêng. Cập nhật web trên GitHub Pages sẽ cập nhật nội dung ứng dụng khi tải lại; không cần đóng gói lại chỉ vì thêm phim hoặc sửa giao diện. Video cần kết nối Internet. Khi mất kết nối không tải được trang, ứng dụng có trang thử kết nối lại.

Lịch sử xem, tài khoản và danh sách lưu trong hồ sơ ứng dụng riêng ở `%APPDATA%/lauphim-desktop`; không tự lấy dữ liệu từ Chrome/Edge. Dùng chức năng xuất/nhập dữ liệu cá nhân có sẵn trên web để chuyển dữ liệu. Không xóa thư mục hồ sơ nếu muốn giữ dữ liệu.

## Chạy và tạo file EXE

Tại thư mục gốc dự án:

```powershell
npm run desktop:install
npm run desktop:start
npm run desktop:build
```

File portable nằm trong `dist-desktop/`. Thư mục `win-unpacked` là bản đã giải nén phục vụ kiểm tra; file portable tự chứa các thành phần cần thiết.

Muốn có bản cài đặt và shortcut:

```powershell
npm run desktop:installer
```

Bản cài đặt tên `LauPhim-Setup-1.0.1-x64.exe`. Đây là bản Windows x64. Bản phát hành hiện chưa ký chứng thư nhà phát hành. Không tắt bảo vệ Windows; chỉ dùng bản tự build hoặc nhận từ nguồn bạn tin cậy.

```powershell
npm run desktop:test
npm run desktop:smoke
```

Kiểm tra smoke dùng hồ sơ tạm riêng, mở ứng dụng ẩn, tải website thật, kiểm tra nguồn phát Taken, trạng thái mất mạng và kết nối lại. Cần Internet và bản đã build.

## Điều khiển

- `Alt`: mở menu ứng dụng.
- `F11`: bật/tắt toàn màn hình.
- `Alt + ← / →`: quay lại / đi tới.
- `Ctrl + R`: tải lại trang.
- Chuột phải vào liên kết phim/logo: mở cửa sổ LauPhim mới.
- Menu LauPhim → Mở web bằng trình duyệt: chuyển sang bản web.

Không cần đổi Frontend hoặc triển khai backend để chạy ứng dụng. Không đưa `dist-desktop/` hay `Desktop/node_modules/` lên GitHub Pages. Không tự phát hành bản build lên mạng; khi muốn chia sẻ có thể đính kèm file EXE trong một GitHub Release.
