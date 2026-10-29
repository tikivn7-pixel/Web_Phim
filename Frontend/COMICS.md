# Đọc truyện — bản thử nghiệm

Mở comics.html, hoặc chọn Đọc truyện trên trang chủ / bảng mở nhanh.

- Truyện mẫu tiếng Việt “Chuyến xe cuối” là nội dung do LauPhim tạo, 3 chương / 6 trang minh họa SVG. Không trình bày dữ liệu mẫu thành dữ liệu từ API.
- Nguồn ngoài: https://comics-api.hieubq.io.vn/api/v1. Hỗ trợ danh sách, tìm kiếm, chi tiết, chương và ảnh theo tài liệu https://comics-api.hieubq.io.vn/api-json.
- Khi triển khai thử, các endpoint nội dung nguồn trả HTTP 500. Tài liệu mở được không đồng nghĩa nội dung đang hoạt động. Không dùng proxy để lách chặn; giao diện có báo lỗi và nút thử lại.
- Tiến độ chương/trang và truyện đã lưu nằm trong comics_reader_v1 theo hồ sơ cục bộ. Chưa nằm trong sao lưu/đồng bộ đám mây của kho phim.
- Mỗi lần chỉ tải một chương, ảnh sau dùng lazy loading. Không sao chép ảnh nguồn vào repository.
- Phím ← / → chuyển chương khi đang đọc, không áp dụng lúc nhập liệu hay mở bảng điều hướng.
