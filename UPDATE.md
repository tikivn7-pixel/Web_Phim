# Cập nhật LauPhim — 24/10/2026

Giữ nguyên 3.697 phim. Trang duyệt, tìm kiếm, thư viện cá nhân và trình phát tiếp tục chạy trên hosting tĩnh, không cần bật backend ở máy nhà. Video và ảnh từ nguồn ngoài vẫn cần Internet.

## Không gian xem, trang chủ cá nhân và điều hướng chung

Phiên bản tài nguyên **`20261024b`**. Cập nhật toàn bộ thư mục `Frontend` để HTML và script cùng phiên bản; tải lại trang sau khi cập nhật.

- **Trang xem được bố trí lại:** video lớn ở bên trái, bảng tập/nguồn/tiện ích ở bên phải. Đổi tab, ẩn hoặc hiện bảng bên cạnh giữ nguyên phần tử video và trạng thái phát. Khi nguồn lỗi, bảng Nguồn tự mở để đổi nguồn hoặc thử lại. Điện thoại xếp bảng dưới video; chế độ rạp và toàn màn hình ẩn điều hướng phụ. Các tập, server, dấu đã xem, intro, tốc độ, hẹn giờ và cảnh đã lưu tiếp tục dùng dữ liệu thật.
- **Trang chủ có phiên xem riêng:** khung bên cạnh phim nổi bật hiển thị số yêu thích, phim đang xem và danh sách riêng trên thiết bị. Nút Tiếp tục xem mở đúng tên tập, vị trí tập trong server, nguồn, server và thời điểm đã lưu. Trạng thái Muốn xem/Tạm dừng/Đã xem được tôn trọng; tổng số tập cũ của phim đang chiếu không tự kết thúc phiên xem. Khi chưa có lịch sử sẽ hiện lối khám phá phim.
- **Điều hướng trên toàn bộ 12 trang:** thanh dưới trên điện thoại dẫn tới Trang chủ, Khám phá, Tập mới và Thư viện. Nút Mở nhanh hoặc **Ctrl+K / ⌘+K** mở bảng tìm phim và 10 lối tắt, gồm Loạt phim, Sổ tay, Danh sách riêng, Tổng quan và Quản lý. Dùng phím mũi tên/Enter/Escape; bảng không chiếm ưu tiên của hộp thoại đang mở, menu điện thoại hoặc trình phát toàn màn hình.
- **Góc nhìn của tôi (`stats.html`):** tổng hợp phim riêng không trùng, phim tự đánh dấu đã xem, tập đã đánh dấu và mốc cảnh; có phân bố trạng thái, điểm riêng, thể loại/quốc gia, hoạt động gần đây, danh sách và lối xem tiếp. Bộ lọc 7/30 ngày dựa trên thời điểm cập nhật bản ghi cá nhân. Nội dung ghi chú không xuất hiện trong dòng hoạt động. Trang chỉ đọc dữ liệu, không suy diễn giờ xem từ vị trí xem dở; có trạng thái rỗng, cảnh báo dữ liệu lỗi và thử tải lại kho.

Từ trang chủ bấm **Tổng quan hành trình**, hoặc từ Thư viện bấm **Hành trình xem phim của bạn** để mở tổng quan. Tại trang xem, chọn các tab **Tập phim / Nguồn / Tiện ích** trong bảng bên cạnh. Thiết lập bố cục trình phát dùng khóa riêng `watch_view_v1`, không thay đổi sao lưu cá nhân.

Kiểm tra: `npm test`, `npm run site:check`, các luồng Chrome trước đó và ba lệnh mới `npm run test:watch`, `npm run test:navigation`, `npm run test:stats`. Kiểm tra trình phát dùng nguồn mô phỏng và chặn tải tệp xuống Downloads; không xác nhận khả năng phát thực tế của mọi nguồn phim ngoài.

## Đồng bộ tập từ terminal, Sổ tay phim và tác vụ hàng loạt

Phiên bản tài nguyên `20261024a`. Cập nhật toàn bộ thư mục `Frontend` để script và HTML cùng phiên bản. Chạy các lệnh dưới tại thư mục gốc dự án với Node.js 22; không cần bật MySQL hoặc backend.

### Lấy tập mới từ KKPhim

```powershell
# Kiểm tra toàn bộ phim có sẵn trong kho
npm run episodes:sync

# Chỉ kiểm tra một phim, kể cả vừa kiểm tra trước đó
npm run episodes:sync -- --slug 100-ngay-lua-doi --force

# Thử 20 phim, chỉ xem báo cáo, chưa ghi tệp
npm run episodes:sync -- --limit 20 --dry-run
```

Lệnh mặc định bỏ qua phim đã kiểm tra thành công trong 6 giờ gần nhất. Dùng đúng `slug` trong catalog; nếu phim có `apiSlug`, lệnh tự dùng slug nguồn. Có thể lặp `--slug` để chọn nhiều phim. Mỗi lần gửi tối đa hai yêu cầu, có timeout và thử lại một lần; phim trả lỗi/sai slug/chưa có link phát không ghi đè kết quả thành công cũ. Nhấn Ctrl+C sẽ ngừng nhận việc mới và lưu các kết quả đã xong. Không tải video.

Mỗi tệp đầu ra có khóa tiến trình để hai lệnh đồng bộ không ghi đè nhau. Khóa được dọn khi hoàn tất, gặp lỗi hoặc Ctrl+C. Nếu bạn buộc tắt tiến trình bằng hệ điều hành, chỉ xóa tệp `.lock` sau khi xác nhận lệnh cũ đã dừng.

Kết quả chi tiết nằm ở `Frontend/data/episode-snapshots.json`, bản nhẹ ở `Frontend/data/episode-summary.json`. Trang chủ/khám phá/thư viện/các trang duyệt chỉ tải bản nhẹ để cập nhật số tập có trên nguồn và trạng thái; dữ liệu mô tả, quốc gia, nhóm phim và archive vẫn giữ nguyên. Sau khi chạy, tải lại web. Nếu dùng hosting, cần đăng hai tệp dữ liệu này lên hosting. Không cần tăng số tập thủ công hay build lại catalog chỉ để hiển thị các quan sát mới.

Đã chạy thử thật **một phim** (`100-ngay-lua-doi`, nguồn trả 4 tập); chưa chạy quét toàn bộ 3.697 phim. Tác vụ này chạy khi bạn thực thi lệnh, chưa có lịch cloud tự chạy khi máy tắt.

### Ghi chú và dấu cảnh

- Trang chi tiết có khung ghi chú riêng: lưu cảm nhận và đánh dấu tiết lộ nội dung. Bản đang soạn không tự bị ghi đè khi tab khác thay đổi dữ liệu.
- Trình phát có mục **Cảnh đáng nhớ**: đặt nhãn, lưu thời điểm đang xem, nhảy lại cảnh hoặc mở đường dẫn đúng tập/nguồn/server. Thời điểm 0 giây và các cảnh dưới 5 giây được khôi phục đúng. Nguồn nhúng không đọc được thời điểm sẽ hiện giới hạn, không lưu mốc giả.
- **Sổ tay phim** (`notes.html`): tìm kiếm, lọc ghi chú/dấu cảnh, sắp xếp, sửa và xóa; nội dung tiết lộ mặc định ẩn. Có lối vào từ trang chủ, trang phim và Thư viện.
- Sao lưu JSON cá nhân bao gồm ghi chú và dấu cảnh; gộp giữ bản mới hơn và giữ cả dấu xóa để bản sao cũ không làm dữ liệu đã xóa xuất hiện lại. Bản sao cũ vẫn nhập được. Tất cả các dữ liệu riêng này ở trên trình duyệt; muốn chuyển thiết bị, xuất rồi nhập bản sao.

### Tác vụ trong Thư viện

Bấm **Chọn nhiều phim** để chọn từng phim hoặc các phim đang hiển thị. Thanh tác vụ cho phép chuyển Muốn xem/Đang xem/Đã xem/Tạm dừng, thêm vào một danh sách riêng, bỏ yêu thích hoặc xóa vị trí phát. Đổi trạng thái giữ nguyên điểm đánh giá và vị trí xem. Thêm vào danh sách loại trùng và kiểm tra đủ chỗ trước khi ghi; không thêm dở dang một phần. Hai thao tác xóa có xác nhận riêng và không xóa phim trong kho.

Chuyển tab hoặc đổi bộ lọc sẽ xóa lựa chọn để tránh tác động nhầm phim. Mỗi tác vụ đọc lại dữ liệu mới nhất và từ chối ghi nếu dữ liệu cũ bị lỗi. Cách sắp xếp được nhớ riêng cho từng tab; truy vấn tìm kiếm không bị lưu vào thiết lập này.

Kiểm tra gồm `npm test`, `npm run site:check`, `npm run test:notes`, `npm run test:bulk` và các luồng Chrome cũ. Các kiểm tra trình phát dùng nguồn mô phỏng, không tải video ngoài. Bài kiểm thử chặn tải JSON xuống Downloads.

## Đợt nâng cấp Khám phá / Tập mới / Danh sách riêng

Phiên bản tài nguyên hiện tại: `20261023h`. Cập nhật toàn bộ `Frontend` để HTML và script cùng phiên bản. Không cần cài thêm thư viện npm. Không có thao tác tự push Git hoặc tự triển khai hosting trong đợt này.

- **Trang chủ:** thêm ba khu vực đi tới Khám phá, Tập mới và Danh sách riêng; số danh sách/phim là dữ liệu thật trên thiết bị. Có mục tập mới riêng, trạng thái khi chưa theo dõi phim và đường vào từ Thư viện. Menu Khám phá chuyển sang trang mới; các URL bộ lọc cũ vẫn hoạt động.
- **Khám phá (`discover.html`):** giao diện riêng, kết hợp tên/quốc gia/thể loại/loại phim/năm, sắp xếp, 24 phim/trang, chế độ lưới hoặc danh sách. Xem nhanh hiện mô tả/diễn viên, mở phim và lưu yêu thích; chỉ tải shard chi tiết khi cần. URL giữ bộ lọc, Back/Forward và quay lại từ trang phim. Không đưa quốc gia vào thể loại, không ghép phim theo tên.
- **Tập mới (`updates.html`):** tự kiểm tra từ KKPhim khi mở trang chủ hoặc mục Tập mới và khi quay lại tab; mỗi phim kiểm tra thành công tối đa mỗi giờ, lỗi thử lại sau 10 phút. Theo dõi tối đa 100 phim gần đây trong yêu thích, lịch sử hoặc nhật ký Muốn xem/Đang xem; phim đánh dấu Đã xem/Tạm dừng được bỏ qua. Hai yêu cầu đồng thời, có timeout, kiểm tra lại thủ công cách nhau tối thiểu 30 giây.
- **Phát hiện tập mới:** lần thành công đầu tạo mốc theo dõi. Các lần sau so sánh tên tập thực sự có link phát, gộp tập trùng giữa các server và bỏ trailer. Không báo toàn bộ danh sách là tập mới, không coi tập cũ tạm bị gỡ rồi xuất hiện lại là mới. Có nút mở đúng tên tập và “Đã biết”. Nguồn lỗi giữ kết quả lần trước; đổi slug nguồn tạo lại mốc. Cache tập mới là bộ nhớ tạm riêng, không thay đổi nguồn catalog hoặc dữ liệu cá nhân.
- **Danh sách riêng (`lists.html`):** thiết kế lại với ảnh ghép bìa, mô tả, form tạo/sửa, xác nhận xóa và lịch chiếu theo thứ tự bạn chọn. Tìm phim có ảnh và phân trang, khóa nút thêm trùng, lọc trong danh sách, xem theo tên/năm, tải thêm mỗi 60 phim. Widget trên trang chi tiết giữ lựa chọn khi có cập nhật ở tab khác. Định dạng dữ liệu cũ và sao lưu giữ nguyên.
- **Độ tin cậy:** compact index bổ sung `apiSlug` để kiểm tra đúng nguồn của phim có slug cục bộ khác. Không thay đổi archive, nhóm phim hoặc poster gốc. Bổ sung kiểm tra dấu tập đã xem, gộp sao lưu và bộ nhớ lỗi. Chrome kiểm thử chặn tải tệp để không tạo thêm JSON trong Downloads của người dùng.

Tự kiểm tra tập mới chỉ chạy khi các trang hỗ trợ đang mở và có mạng. Khi đóng web, không có tác vụ nền trên cloud. Website không tự ghi lại file trong máy bạn hay cập nhật hosting. Việc tự chạy định kỳ và triển khai khi không ai mở web chưa được kích hoạt.

Kiểm tra: `npm test`, `npm run site:check`, `npm run test:browser`, `npm run test:discover`, `npm run test:lists`, `npm run test:updates`, cùng các lệnh kiểm tra collections/picker/provider cũ. Các bài kiểm tra trình duyệt dùng nguồn mô phỏng và chặn video ngoài; chúng không chứng minh mọi server phim thực đều đang hoạt động.

## Cập nhật tiếp: chọn phim và nhật ký cá nhân

- **Tối nay xem gì?** Mở **Chọn phim** trên menu hoặc `Frontend/picker.html`. Chọn kiểu phim, thể loại, quốc gia và khoảng năm; nhận một hoặc ba phim đúng bộ lọc. Các lượt đổi gợi ý không lặp lại cho đến khi hết danh sách, có nút bắt đầu lại. Có thể bỏ qua phim đã xem, chia sẻ bộ lọc và dùng Back/Forward.
- **Nhật ký phim:** tại trang chi tiết, chọn **Muốn xem / Đang xem / Đã xem / Tạm dừng** và chấm từ 1 đến 5 sao. Trạng thái và điểm là của riêng bạn trên trình duyệt này. Đánh dấu đã xem hoặc tạm dừng ẩn phim khỏi mục xem tiếp nhưng giữ nguyên vị trí từng tập; bỏ trạng thái sẽ hiện lại nếu phim còn xem dở.
- **Thư viện mở rộng:** các tab Muốn xem, Đã xem và Nhật ký, lọc trạng thái, sắp theo điểm cá nhân và thống kê. Sao lưu JSON bao gồm nhật ký; gộp giữ thay đổi mới hơn, kể cả khi đã bỏ trạng thái/điểm. Bản sao cũ vẫn nhập được.
- **Gợi ý theo gu:** trang chủ có mục **Dành cho gu phim của bạn**, dựa trên phim yêu thích và phim bạn chấm 4–5 sao. Từng gợi ý ghi rõ phim làm cơ sở; loại phim đã lưu, đang xem, đã đánh dấu hoặc đã chấm điểm khỏi danh sách. Quan hệ loạt phim vẫn dùng nhóm xác minh bằng slug.
- **Thêm phim từ nguồn:** mở `Frontend/manage.html`, dán slug hoặc link phim từ KKPhim/PhimAPI, lấy metadata rồi xem trước. Chỉ khi bấm **Điền vào biểu mẫu** thông tin mới chuyển sang ô sửa; bấm **Lưu bản nháp** mới lưu vào bản nháp. Phát hiện slug/slug nguồn đã có và mở phim hiện tại, không tự ghi đè. Nguồn ghi nhiều quốc gia cần chọn quốc gia chính. Để cập nhật kho công khai, xuất JSON và chạy lệnh nhập catalog như hướng dẫn bên dưới.

Không cần thêm thư viện npm hay build lại catalog cho các tính năng giao diện này. Tải lại trang để dùng phiên bản tài nguyên `20261023e`.

Kiểm tra cho đợt này: `npm test` (101 kiểm tra), `npm run site:check`, `npm run test:browser`, `npm run test:collections`, `npm run test:picker`, `npm run test:provider`. Kiểm tra trình duyệt dùng metadata/nguồn phát mô phỏng và chặn tải video bên ngoài; không xác nhận độ ổn định của mọi server phát thực tế.

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
