# Cập nhật LauPhim — 23/10/2026

Giữ nguyên 3.697 phim. Trang duyệt, tìm kiếm, thư viện cá nhân và trình phát tiếp tục chạy trên hosting tĩnh, không cần bật backend ở máy nhà. Video và ảnh từ nguồn ngoài vẫn cần Internet.

## Giao diện và khám phá mới

- **Trang chủ mới:** hero ba poster, thông tin năm/quốc gia/tập/thể loại, 6 chủ đề có số phim thực, 3 loạt phim nổi bật và nút chọn ngẫu nhiên một phim. Các mục đều dẫn tới bộ lọc hoặc phim thật trong kho.
- **Loạt phim:** `Frontend/collections.html` duyệt đủ 200 nhóm với 544 phim/mùa đã liên kết. Có tìm kiếm, quốc gia, loại phim, sắp xếp và phân trang; từng nhóm có trang riêng, danh sách phần theo thứ tự và giữ bộ lọc khi quay lại.
- **Thẻ phim và khám phá:** poster có nhãn loại/tập, trạng thái yêu thích rõ, tiêu đề hai dòng; bộ lọc đang áp dụng có thể bỏ từng mục. Menu đưa khám phá, loạt phim và thư viện lên vị trí chính.
- **Trang chi tiết:** ảnh nền từ phim, bố cục poster/thông tin mới, nút xem tiếp đúng vị trí, chia sẻ đường dẫn, tìm tập và tải thêm từng 60 tập. Mục diễn viên, trailer và hình ảnh chỉ hiện khi có dữ liệu tương ứng.
- **Mobile:** thiết kế riêng cho màn hình nhỏ, giữ ảnh và nội dung đọc được, có kiểm tra ở 320/390/1024/1440 px.

Đợt thay đổi này cần cập nhật cả HTML, CSS và JS trong `Frontend`, không chỉ thư mục `data`. Các đường dẫn tài nguyên đã đổi phiên bản để tránh trộn giao diện mới với script cũ. Không cần build lại kho phim để nhìn thấy giao diện mới trên Live Server.

## Những gì đã thay đổi

**Quản lý nhóm phim:** mở `Frontend/manage.html`, chọn **Nhóm & các phần phim**. Tìm nhóm, chọn từng phim bằng slug, sửa nhãn, sắp thứ tự, tách phim, xóa nhóm hoặc tạo nhóm mới. Xem trước các nút chọn phần ngay trong trang. Mỗi phim thuộc một nhóm chính, không nối các nhóm qua tên giống nhau. Tách phim tạo loại trừ để metadata không tự ghép lại. Liên kết chỉ được xuất khi nhóm có ít nhất hai phim và một URL nguồn HTTPS.

**Quản lý thông tin:** slug của phim đã lưu được giữ cố định để tránh hỏng liên kết; có trường slug nguồn phát riêng. Cảnh báo khi rời ô nhập chưa lưu; yêu cầu xác nhận trước khi bỏ bản nháp/nhập thay thế. Bản nháp nhóm và thông tin phim được lưu riêng.

**Thư viện cá nhân:** mở **Thư viện** trên menu. Có danh sách yêu thích, xem tiếp, tìm kiếm và sắp xếp. Sao lưu JSON và xem trước khôi phục, chọn gộp hoặc thay thế. Bản gộp giữ tiến độ có thời gian cập nhật mới hơn, kể cả khi đã tua lại. Có thiết lập phát và mốc intro, không có token tài khoản hay hẹn giờ của phiên cũ. Bộ nhớ bị chặn/đầy có thông báo; nhập lỗi cố gắng phục hồi nguyên các giá trị trước đó. Danh sách dài tải thêm từng 60 phim.

**Trang xem:** nhớ tốc độ, âm lượng/tắt tiếng; hẹn giờ dừng 15–90 phút; tự chuyển tập mặc định tắt. Intro chỉ được bỏ qua khi bạn đánh dấu hai mốc cho đúng tập/nguồn, không mặc định đoán 90 giây. Có hướng dẫn phím tắt, không chiếm phím khi nhập liệu/chọn nút/thanh trượt. Nguồn nhúng chỉ hỗ trợ những chức năng thực sự đọc được, không hiện chất lượng/phụ đề giả.

Tập trước/sau và tự chuyển tập dựa vào số tập thực tế ngay cả khi server trả về danh sách đảo thứ tự. Khôi phục vị trí kiểm tra đúng danh tính tập và nguồn/server đối với dữ liệu cũ. Xem hết tập mới nhất của bộ đang phát hành không bị coi nhầm là xem xong toàn bộ. Plyr và bản sao dữ liệu dùng chung thiết lập tốc độ/âm lượng để tránh ghi đè lẫn nhau.

**Tìm kiếm và duyệt phim:** tìm không dấu, theo từ không bắt buộc đúng thứ tự, thêm slug tiếng Việt, ưu tiên tên khớp nhất. Khi mục diễn viên/đạo diễn tải lỗi, vẫn tìm được theo tên. Gợi ý nhanh hỗ trợ bàn phím và nhãn trợ năng. Không giữ lựa chọn cũ khi gõ truy vấn mới. Chỉ có một thanh phân trang hoạt động. Bộ lọc, URL và quay lại danh sách được giữ.

**Trang chi tiết và giao diện:** hiển thị dữ liệu cục bộ trước khi gọi nguồn phát, lỗi tải có nút thử lại. Sửa tiêu đề/yêu thích khi mở bằng slug trực tiếp, viewport mobile, ảnh dự phòng nội bộ. Gợi ý cùng thể loại ưu tiên số thể loại chung, quốc gia và loại phim; không dùng làm quan hệ phần phim. Thẻ phim có liên kết mở tab mới và không chèn dữ liệu vào mã onclick. Hero có dừng trình chiếu, tôn trọng giảm chuyển động và focus. Trang chủ bỏ thư viện video không sử dụng.

## Áp dụng thay đổi từ trang quản lý

Sửa thông tin phim → lưu bản nháp → xuất `catalog-import.json`:

```powershell
npm run catalog:import -- "C:\duong-dan\catalog-import.json"
```

Sửa nhóm → lưu → xuất `movie-relations-import.json`:

```powershell
npm run relations:import -- "C:\duong-dan\movie-relations-import.json"
```

Nếu thêm phim mới, nhập catalog trước rồi nhập nhóm. Hai file khác nhau để tránh thay đổi nhầm thông tin và liên kết. Việc lưu trên trang quản lý chỉ lưu nháp trong trình duyệt, chưa thay đổi website công khai.

Nếu sửa nguồn bằng code, chạy `npm run catalog:build`. Hướng dẫn nguồn và quy tắc nhóm: [Backend/CATALOG.md](Backend/CATALOG.md), [Backend/RELATIONS.md](Backend/RELATIONS.md).

Đăng lại toàn bộ file giao diện mới và `Frontend/data` cùng ảnh mới. Nếu cập nhật theo thứ tự: đưa các file chi tiết có hash lên trước, index sau. Không xóa ngay các shard cũ vì người xem có thể đang dùng index cũ. Tải lại bằng Ctrl + F5 sau khi cập nhật; Node chỉ cần lúc build/nhập dữ liệu.

## Kiểm tra

```powershell
npm test
npm run site:check
npm run test:browser
npm run test:collections
```

`site:check` kiểm tra cú pháp script, tài nguyên nội bộ của năm trang và đối chiếu đủ từng phim trong 32 shard với archive/index. Browser smoke dùng Chrome headless, dữ liệu phát mô phỏng, kiểm tra mobile, luồng nhóm, thư viện, khôi phục, phím tắt/intro/tốc độ/hẹn giờ và tải lỗi/thử lại. Không tải video thật. Kiểm tra nguồn video, CDN ảnh và tốc độ hosting thật cần thực hiện trên môi trường triển khai.

## Những việc vẫn cần dữ liệu thực tế

Metadata nhà cung cấp có thể sai; phim chưa đủ bằng chứng không bị đoán nhóm hay xóa khỏi kho. Các nhóm cũ cần rà soát có trong `Backend/relations-review.md`. Chưa thêm đánh giá người dùng/bình luận/đồng bộ đa thiết bị tự động vì những chức năng đó cần backend và quy trình quản lý; thư viện hiện dùng bản sao JSON để chuyển thiết bị.
