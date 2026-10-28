# Rà soát ngày 28/10/2026

Phạm vi: mã nguồn Frontend, Backend, Desktop và scripts; không sửa thư viện cài sẵn hay dữ liệu cá nhân trong trình duyệt.

## Các lỗi đã sửa

- Phím tắt trình phát bị chặn khi một modal nằm trong vùng giao diện ẩn.
- Mốc opening đã xóa có thể xuất hiện lại sau khi đồng bộ đám mây.
- Đóng rồi mở nhanh bảng điều hướng khiến ô tìm kiếm mất focus.
- Mã phát hành thay đổi giả do Git chuyển LF/CRLF; stamp thiếu hoặc cũ được sửa lại mà không tạo phiên bản giả.
- Kiểm tra trùng phim bỏ sót bản phụ có tên khác; không tự gộp phim chỉ vì trùng tên.
- Kiểm tra catalog báo nhầm các bản phụ đã xác nhận; kiểm tra tài nguyên HTML nay bao gồm ảnh.
- Ảnh banner thiếu của Bí Kíp Luyện Rồng 2 dùng poster đã có làm dự phòng.
- Lệnh npm test nay chạy toàn bộ tệp kiểm thử; sửa fixture cloud thiếu dữ liệu và các bước chờ trình duyệt chưa ổn định.
- Cập nhật các dependency backend bị npm audit cảnh báo. Bỏ JWT secret mặc định dễ đoán; kiểm tra độ dài khóa, khóa tạm sinh ngẫu nhiên và giới hạn thuật toán HS256.

## Phim mới

Thêm 9 mục theo API KKPhim: Stranger Things mùa 1–5, Tales From '85 mùa 1–2, Beyond Stranger Things và One Last Adventure. Số tập lần lượt theo nguồn phát. Hai loạt mùa dùng hai TMDB TV ID riêng (66732 và 224263); hai mục hậu trường đứng riêng. Không tải video về kho mã.

Kho hiện có 3.744 bản ghi, 3.686 thẻ duyệt và 58 bản phụ đã xác nhận. Giữ toàn bộ phim cũ và đường dẫn alias.

## Kiểm tra

- 246 kiểm thử tự động đạt bằng npm test.
- Cả 14 bộ kiểm tra giao diện đã đạt; bộ browser-smoke được chạy lại sau khi cập nhật số lượng phim và nhóm trong fixture.
- Kiểm tra website: 18 trang, 104 script, 629 tham chiếu tài nguyên, 32 phần dữ liệu chi tiết.
- catalog:check: 0 lỗi, 1 cảnh báo cũ về group thiếu partName của phim Slime. Group cũ này không được dùng làm quan hệ đã xác minh.
- 331 gợi ý metadata cần đối chiếu không được coi là lỗi đã xác nhận; không tự xóa hay ghép phim.
- npm audit: 0 lỗ hổng được báo trong dependency đã kiểm tra của root, Backend và Desktop.
- Backend HTTP được kiểm thử với Express thật và SQL giả lập; không chạy migration hay ghi vào cơ sở dữ liệu thật.

## Cần đổi khóa ở nhà cung cấp

Backend/.env và repomix-output.xml từng được Git theo dõi và chứa cấu hình bí mật. Đã bỏ chúng khỏi phiên bản mới, giữ bản cục bộ và thêm quy tắc ignore. JWT_SECRET cục bộ đã thay; phiên đăng nhập backend cũ sẽ hết hiệu lực khi khởi động lại backend.

**Cần đổi mật khẩu cơ sở dữ liệu và khóa TMDB tại dịch vụ tương ứng, sau đó cập nhật Backend/.env.** Bỏ file khỏi phiên bản mới không xóa giá trị cũ trong lịch sử Git. Không tự viết lại lịch sử hay force-push. Xem Backend/AUTH.md để cấu hình riêng tư.
