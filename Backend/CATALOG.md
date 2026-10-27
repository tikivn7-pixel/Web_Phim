Kho phim tĩnh — không cần bật backend
====================================

Frontend đọc `Frontend/data/catalog-index.json` từ hosting tĩnh và chỉ tải
chi tiết trong `Frontend/data/details/` khi mở phim. `data/movies.json` là
bản đầy đủ dành cho trang quản lý và xuất/nhập dữ liệu, không tải ở trang chủ.
Không cần MySQL, Railway hoặc chạy npm start để duyệt/tìm/xem phim.
Toàn bộ 3.708 bản ghi phim, năm và thông tin diễn viên được giữ lại. Quan hệ phần phim
chỉ xuất khi có mã bộ phim hoặc nguồn đối chiếu, không suy ra từ tên giống nhau.
Xem [RELATIONS.md](RELATIONS.md) để thêm liên kết từng slug và cập nhật metadata.
Các bản đăng trùng đã đối chiếu được đánh dấu `duplicateOf` và `duplicateSources`
trong nguồn. Trang duyệt hiện một thẻ cho mỗi phim đã xác nhận; dữ liệu đầy đủ
vẫn giữ bản phụ và `catalog-index.json.aliases` giữ đường dẫn chi tiết để các URL
cũ tiếp tục mở được. Hiện có 3.652 thẻ duyệt và 56 bản phụ đã xác nhận. Không tự
gộp phim chỉ vì trùng tên hoặc poster; khi thêm đánh dấu phải có nguồn HTTPS,
mã phim chính phải tồn tại và không được tự trỏ/nối vòng.
Frontend/data.js chỉ chứa cấu hình và hàm hỗ trợ.

Đưa toàn bộ thư mục Frontend lên hosting tĩnh, bao gồm cả thư mục data và details bên trong.
Mở đường dẫn website trên điện thoại/máy tính khi ra ngoài. Máy ở nhà có thể tắt.
Vẫn cần Internet để tải website, ảnh và video từ các nguồn phát.
Mở HTML bằng file:// có thể bị trình duyệt chặn fetch JSON; dùng URL hosting.

Trình duyệt tải danh sách nhẹ một lần trong mỗi trang rồi lọc và phân trang tại máy.
Chỉ mục diễn viên/đạo diễn catalog-search.json chỉ tải khi tìm kiếm.
Thông tin đầy đủ được chia thành 32 phần; mở phim chỉ tải phần chứa phim đó.
Chia nhỏ giúp giảm dữ liệu ban đầu, không giảm tổng dữ liệu cần lưu trên hosting.
Trang kết quả vẽ 24 phim mỗi trang, slider vẽ tối đa 20 phim.

Khi cập nhật phim:

1. Các script thêm/sắp xếp phim trong Frontend chỉnh Backend/catalog-source.js.
2. Nếu sửa tay: chạy từ thư mục gốc `npm run catalog:build`.
   Các lệnh thêm/sắp xếp/nhóm phim và build-cast tự xuất JSON khi thành công.
3. Đăng lại toàn bộ Frontend/data lên hosting và xóa cache hosting nếu có.

Node chỉ cần lúc xuất dữ liệu, không cần khi xem.

API_BASE_URL mặc định rỗng. Đăng nhập/đăng ký và đồng bộ tài khoản vẫn cần
backend; danh sách và nguồn link phim không phụ thuộc backend riêng.
catalog.js và migrate-catalog.js giữ lại cho tùy chọn MySQL về sau;
frontend hiện không gọi các API này.

Poster lưu trong Frontend/Img/posters/<slug>.jpg được build-catalog.js ưu tiên
thay cho link CDN. URL gốc giữ ở remotePoster để dự phòng. Khi đăng lại web,
nhớ đăng cả thư mục Img/posters. Có thể thêm ảnh theo tên slug này rồi xuất lại.
Ảnh lỗi được thử lại một lần, rồi dùng ảnh dự phòng trước khi hiện placeholder nội bộ.

Các tính năng mới
----------------

- Chọn KKPhim/NguonC ngay trên trang xem; lỗi HLS thử phục hồi một lần mỗi loại
  lỗi trước khi báo đổi nguồn. Nút server không có tập hiện tại sẽ bị vô hiệu.
  Đổi nguồn khớp theo tên tập, không tự chuyển sang tập khác.
- Lưu tiến độ mỗi 5 giây, khi tạm dừng, đổi tab, chuyển tập và rời trang.
  Tiếp tục xem giữ nguồn/server, hiện thời điểm đang xem và có nút xóa.
  Dữ liệu chỉ nằm trên trình duyệt/thiết bị hiện tại. Iframe khác tên miền
  không cho đọc thời gian: chỉ lưu tập đã mở, không khôi phục thời điểm.
- Nút Tất cả phim, Phim bộ, Phim lẻ, Anime/Hoạt hình mở bộ lọc kết hợp
  quốc gia + thể loại + năm + loại phim; sắp xếp cập nhật/năm mới nhất/tên.
- Backend/catalog-manifest.json theo dõi ngày thêm/sửa kể từ lần xuất đầu.
  Phim cũ chưa biết ngày được xếp theo năm phát hành. Không gán ngày giả.
  Giữ manifest trên máy phát triển khi cập nhật; không cần đăng lên hosting.
  Có thể đặt type trong nguồn: single, series, hoathinh/animation, tvshows.
  Khi thiếu type, suy từ thể loại và số tập; sửa type nếu nguồn phân loại sai.
- Menu di động hỗ trợ chạm, bàn phím và Esc; tìm kiếm nằm trên hàng riêng,
  bộ lọc/lưới hai cột, nút chọn tập/server có vùng chạm tối thiểu 44px.

Lệnh kiểm tra (từ thư mục gốc)
-----------------------------

```powershell
npm run catalog:check
npm run catalog:check -- --check-images --max=30
npm run catalog:build
npm test
npm run test:browser
```

Kiểm tra ảnh online là tùy chọn, tối đa 3 kết nối đồng thời; lỗi mạng được báo
cảnh báo, không tự xóa phim. Xuất JSON bị chặn nếu trùng slug, thiếu tên hoặc
số tập không hợp lệ. Link ảnh nội bộ thiếu, nhóm thiếu partName, năm/số tập
bất thường và các mục dùng chung apiSlug được báo để rà soát.

Hiện còn hai cảnh báo dữ liệu được giữ nguyên: một phim Slime thiếu partName
(giao diện dùng tên phim) và hai mục Sakamoto Days dùng chung nguồn phát.
Mục Sakamoto có slug cũ phim/sat-thu-ve-vuon được sửa đường dẫn API bằng apiSlug.

test:browser dùng Chrome đã cài trên Windows; đặt CHROME_PATH nếu cần.
Nguồn phát và đồng hồ video được giả lập trong bài kiểm tra để không tải phim.

Quốc gia
--------

Bộ lọc sử dụng `country` (quốc gia chính), không chọn theo thứ tự của menu và
không tự đưa một phim vào mọi quốc gia xuất hiện trong genres. Với mục cũ chưa
đặt country, dùng quốc gia đầu tiên theo thứ tự gốc như phương án dự phòng.
Khi thêm/sửa phim có metadata nhiều nước, đặt rõ `country: "Nhật Bản"` (ví dụ).
Bot thêm phim cũng ghi country riêng. Các tag quốc gia gốc được giữ lại trong
sourceCountries để đối chiếu; chúng có thể bao gồm nhãn sai hoặc nước đồng sản xuất.
Không có quy tắc suy từ chữ Anime hay thương hiệu Nhật để đổi tất cả sang Nhật.

Thể loại xuất ra JSON được tách hoàn toàn khỏi tên nước (kể cả Canada, Ba Lan,
Bỉ, Brunei, Chile, Comoros...). Các nhãn nước gốc nằm trong sourceCountries;
country vẫn là quốc gia chính dùng để lọc, tránh đưa anime Nhật trở lại Mỹ/Trung Quốc
chỉ vì nhãn nguồn phụ. Nhãn Chính kịch/Chính Kịch, Tâm lý/Tâm Lý, học Đường/Học Đường
được gộp, nhãn gộp sai dấu chấm và Khoa HọcViễn Tưởng được tách thành thể loại riêng.

Đã sửa rõ quốc gia chính cho những mục nguồn gắn sai trong ảnh phản hồi:
Aharen S2, Chained Soldier, Metallic Rouge, Pon no Michi, Ancient Magus' Bride.
Blades of the Guardians S2 giữ Trung Quốc. Mario Galaxy/Sonic Prime/Ultraman Rising
vẫn giữ nhóm Mỹ để không bị đổi sang Nhật chỉ vì nguồn xếp Nhật trước.
Đây là phân nhóm chính để duyệt web, không phủ nhận đồng sản xuất nhiều nước.

Nguồn đối chiếu: https://aharen-pr.com/ ; https://www.bones.co.jp/work/metallicrouge/ ;
https://www.e-muse.com/en/animation/chained-soldier/ ; https://mahoyome.jp/staffcast/ ;
https://www.youtube.com/watch?v=mZXYWirGoZo (Tencent Video-ANIMATION) ;
https://www.illumination.com/movie/1238/ ; https://www.wildbrain.com/shows/sonic-prime ;
https://www.netflix.com/tudum/articles/ultraman-rising-release-date-photos ;
https://www.koreanfilm.or.kr/eng/films/index/filmsView.jsp?movieCd=20128546 .

Quản lý, rà soát, URL và trình phát
---------------------------------

Mở `Frontend/manage.html` bằng Live Server hoặc `/manage.html` trên hosting.
Trang này tải bản đầy đủ, có form thêm/sửa, xem trước poster, bản nháp localStorage,
nhập/xuất JSON, danh sách cảnh báo và tải báo lỗi phát đã lưu trên cùng thiết bị.
Không có API ghi lên website: người khác mở trang này cũng chỉ sửa bản nháp của họ.

Sau khi sửa và xuất catalog-import.json:

```powershell
npm run catalog:import -- "C:\duong-dan\catalog-import.json"
```

Lệnh kiểm tra dữ liệu, sao lưu nguồn vào Backend/catalog-source.js.before-import.bak,
nhập lại catalog-source.js ở định dạng tương thích các script cũ rồi chạy build.
Nguồn mới được ghi qua file tạm rồi thay thế. Nếu build thất bại (ví dụ file nhập
bỏ một slug vẫn còn trong cấu hình liên kết), lệnh tự khôi phục nguyên nội dung
catalog-source.js trước khi nhập; bản sao lưu vẫn được giữ. Sửa lỗi được báo rồi
chạy lại `npm run catalog:build` để đồng bộ các file xuất trước khi đăng hosting.
Lệnh khôi phục nguồn, không coi một lần build bị gián đoạn là bản dữ liệu để đăng.
Nguồn nhập là dữ liệu đã xuất từ form, nên các bình luận trình bày trong nguồn cũ
không được giữ ở bản mới; bản sao lưu vẫn giữ nguyên. Tên, mô tả, trường phụ được giữ.
Nếu chỉ sửa bằng code, tiếp tục dùng catalog-source.js và catalog:build như trước.

Mỗi lần build xuất Backend/catalog-audit-report.md và Frontend/data/catalog-audit.json.
Báo cáo duyệt đủ toàn kho: trùng slug/tên/nguồn, thiếu năm/ảnh/tên phần,
khoảng trống mùa, phim lẻ nhiều tập và nhãn nhiều quốc gia cần đối chiếu.
Cảnh báo không khẳng định phim sai, không tự xóa hoặc tự gộp dữ liệu.
Kiểm tra ảnh online vẫn tùy chọn bằng catalog:check -- --check-images --max=30.

Trang kết quả lưu bộ lọc vào q/country/genre/year/type/sort và trang hiện tại vào p.
`view=catalog` phân biệt với trang chủ/yêu thích. Reload, Back/Forward và nút
Quay lại danh sách ở chi tiết/trang xem khôi phục trạng thái; có thể chia sẻ URL.

Chất lượng HLS lấy từ danh sách luồng thật; nguồn chỉ có một mức hoặc trình phát
nhúng sẽ không tạo lựa chọn 360p/720p giả. Phụ đề lấy từ HLS hoặc textTracks gốc.
Nếu nguồn đốt phụ đề vào video hoặc không có track rời thì không thể tắt/chọn lại.
Báo nguồn lỗi chỉ lưu vào playback_reports trên thiết bị; bấm tải JSON để gửi
cho người quản lý khi cần. Không tự gửi thông tin đến dịch vụ bên ngoài.

Mốc kiểm tra hiện tại: catalog-index khoảng 0,86 MB, bản đầy đủ khoảng 2,25 MB,
phần chi tiết lớn nhất khoảng 94 KB (trước nén HTTP). Danh sách giảm khoảng 62%.
Chrome giả lập 1,6 Mbps/150 ms cho danh sách sẵn sàng khoảng 6,5 giây; đây là
phép thử local, loại trừ ảnh ngoài web và nguồn phim, không phải cam kết tốc độ hosting.
File chi tiết có tên chứa hash để cache an toàn. Build giữ phần cũ để tránh hỏng
phiên đang dùng index cũ; khi đăng hosting hãy đăng file chi tiết trước, index sau.

## Duplicate review

Run `npm run catalog:duplicates` for an offline whole-catalog report, or append `-- --refresh` to refresh source evidence. See `DUPLICATES.md`, `duplicate-decisions.json` and `duplicate-evidence.json`. Matching titles, artwork and cached IDs only nominate candidates; reviewed explicit `duplicateOf` mappings control visible cards. Alternate names remain searchable; full records and old slugs remain available.
