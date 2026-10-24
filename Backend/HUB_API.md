# LauPhim Hub

Hub là dịch vụ Node riêng dành cho đồng bộ tài khoản, hồ sơ, cộng đồng, quản trị, phòng xem chung và cập nhật tập theo lịch. GitHub Pages tiếp tục phục vụ giao diện. GitHub Pages không chạy tiến trình Node; muốn cập nhật lúc máy cá nhân tắt cần đặt Hub trên một máy chủ luôn hoạt động, có HTTPS và ổ đĩa bền vững.

Không cần cài MySQL hay các package của backend cũ. Hub dùng các module tích hợp trong Node 22 và mô hình dữ liệu dùng chung ở `Frontend/`. Backend cũ `server.js` được giữ riêng.

## Chạy trên máy cá nhân

Từ thư mục gốc dự án, PowerShell:

```powershell
$env:HUB_DATA_DIR = 'E:\Vscode\web_phim\Backend\.hub-data'
$env:HUB_ALLOWED_ORIGINS = 'http://127.0.0.1:5500,http://localhost:5500'
$env:HUB_EPISODES_ENABLED = 'true'
node Backend/hub-server.cjs
```

Mở `http://127.0.0.1:8787/` để dùng cả web và API cùng nguồn. Nếu vẫn dùng Live Server, đặt địa chỉ Hub là `http://127.0.0.1:8787` trong phần kết nối tài khoản của web. Không dùng IP LAN hay tên miền bên ngoài với HTTP; tài khoản trên Internet cần HTTPS.

Mặc định lắng nghe `127.0.0.1:8787`; `HUB_HOST` đổi địa chỉ bind. `PORT` hoặc `HUB_PORT` đổi cổng. Chạy thủ công mặc định tắt lịch cập nhật; `HUB_EPISODES_ENABLED=true` bật quét ngay khi khởi động rồi mỗi 6 giờ. `HUB_EPISODE_INTERVAL_MS` có mức tối thiểu 1 giờ. Mỗi phim kiểm tra thành công được nghỉ ít nhất 6 giờ theo quy tắc của CLI dùng chung.

## Triển khai cùng GitHub Pages

1. Chuẩn bị máy chủ hỗ trợ Node 22 hoặc Docker, HTTPS và persistent volume; chạy **một** instance Hub cho mỗi thư mục dữ liệu.
2. Đặt `HUB_DATA_DIR` vào volume bền vững, nằm ngoài thư mục công khai `Frontend/`. Trong image đã đặt sẵn `/var/lib/lauphim`, UID/GID 1000. Volume bind từ host phải cho người dùng này quyền ghi.
3. Đặt `HUB_HOST=0.0.0.0`, cổng theo nền tảng; `HUB_ALLOWED_ORIGINS=https://ten-tai-khoan.github.io` hoặc origin của tên miền riêng. Chỉ ghi origin: **không** thêm `/Web_Phim`, dấu `/` cuối, `*` hay nhiều origin cách nhau bởi khoảng trắng. Nhiều origin ngăn cách bằng dấu phẩy.
4. Nếu reverse proxy chấm dứt TLS và cũng phục vụ giao diện trực tiếp từ Hub, đặt thêm `HUB_PUBLIC_ORIGIN=https://hub.example.com`. Không tin các header chuyển tiếp do client gửi.
5. Bật `HUB_EPISODES_ENABLED=true`; cấu hình thời gian dừng ít nhất 40 giây để lưu kết quả và đóng khóa. Cho phép kết nối ra `https://phimapi.com`.
6. Sau khi triển khai, trong trang tài khoản của web nhập URL HTTPS của Hub rồi kết nối. Đăng ký tài khoản, đăng nhập và chọn hồ sơ. Mỗi trình duyệt cần cấu hình đúng Hub.
7. Kiểm tra `GET https://hub.example.com/api/hub/health`, sau đó `/api/hub/episodes/summary` khi lần quét đầu hoàn tất. Quét toàn bộ danh mục có thể mất nhiều phút; dữ liệu từng đợt được lưu lại, lỗi nguồn không xóa kết quả thành công cũ.

Không có tài khoản cloud nào được tạo, không có dịch vụ nào được trả phí hoặc triển khai tự động từ repository này.

Docker từ thư mục gốc:

```powershell
$env:HUB_ALLOWED_ORIGINS = 'https://ten-tai-khoan.github.io'
$env:HUB_PUBLIC_ORIGIN = 'https://hub.example.com'
docker compose -f Backend/compose.hub.yaml up -d --build
```

Compose gắn named volume, chỉ mở cổng localhost cho reverse proxy HTTPS của host. Muốn deploy qua nền tảng khác, dùng Dockerfile `Backend/Dockerfile` với **build context là thư mục gốc** và volume `/var/lib/lauphim`. Quy tắc context/ignore theo [Docker build context](https://docs.docker.com/build/concepts/context/); thời gian dừng theo [Docker Compose services](https://docs.docker.com/reference/compose-file/services/).

### Tài khoản quản trị

Không có mật khẩu mặc định, không tự cấp admin cho người đăng ký đầu tiên, không cấp admin chỉ vì email gửi lên trùng biến môi trường. Chủ máy chủ phải đăng ký tài khoản của mình, dừng Hub, rồi chạy CLI vào **đúng volume dữ liệu**:

```powershell
node Backend/hub-server.cjs --promote tai-khoan-da-dang-ky@example.com
```

Khởi động lại Hub rồi đăng nhập. Với Docker Compose đang dừng:

```powershell
docker compose -f Backend/compose.hub.yaml stop hub
docker compose -f Backend/compose.hub.yaml run --rm --no-deps hub node Backend/hub-server.cjs --promote tai-khoan-da-dang-ky@example.com
docker compose -f Backend/compose.hub.yaml up -d hub
```

CLI từ chối chạy nếu một tiến trình khác đang giữ khóa dữ liệu. Email chưa có tài khoản không được tự tạo. Đây là thao tác chủ máy chủ, không có API công khai để tự nâng quyền.

## Lưu dữ liệu và phục hồi

`hub.json` chứa tài khoản, mật khẩu băm scrypt với salt riêng, hash của token phiên, hồ sơ, đánh giá, báo cáo và các phiên bản chỉnh sửa danh mục. Token gốc chỉ được trả một lần khi đăng nhập; session hết hạn sau 30 ngày và thu hồi khi đăng xuất. Giữ volume riêng tư; không đưa `hub.json` vào GitHub Pages hoặc Git.

`episodes/` chứa danh mục hợp nhất dùng cho lần quét, snapshot đầy đủ và summary công khai. Mỗi lần quét lấy danh mục gốc cộng chỉnh sửa/thêm phim từ quản trị. Đổi `apiSlug` sẽ kiểm tra đúng nguồn mới; không suy liên kết theo tên phim. Không tải video, không ghi đè archive `Frontend/data/movies.json`.

Ghi dữ liệu được tuần tự hóa, fsync file tạm rồi thay thế nguyên tử. `hub.lock` ngăn hai process ghi đồng thời; CLI tập có khóa riêng. Khi dừng bình thường, Hub ngừng lấy phim mới, chờ request đang chạy, lưu thành công và tháo khóa. File dữ liệu lỗi khiến khởi động thất bại; dịch vụ không tự xóa hoặc đổi thành dữ liệu rỗng.

Để sao lưu, dừng Hub rồi sao chép toàn bộ `HUB_DATA_DIR` vào chỗ riêng an toàn; khởi động lại. Để phục hồi, dừng Hub, giữ bản hiện tại, khôi phục bản sao đã kiểm tra rồi khởi động. Nếu máy chủ bị kill hoặc mất điện để lại `hub.lock` / `episodes/episode-snapshots.json.lock`, **xác nhận mọi tiến trình/instance dùng volume đã dừng** trước khi xóa đúng các file khóa này. Không xóa `hub.json`. Khóa không tự hết hạn vì một lần quét dài vẫn có thể đang ghi. Không chạy nhiều replica chung volume JSON này.

Phòng xem dùng RAM và hết hạn tối đa 2 giờ; restart làm đóng phòng. Tiền sử chat không được lưu vào dữ liệu tài khoản. Hồ sơ, đánh giá, chỉnh sửa và kết quả tập vẫn còn sau restart có volume.

## Quy ước API

Base path `/api/hub`. JSON UTF-8; body phải là đối tượng với `Content-Type: application/json`. Token tài khoản ở `Authorization: Bearer TOKEN`; token thành viên phòng ở `X-Room-Token: TOKEN`. Không gửi token qua URL. Browser chỉ được gọi từ origin chính xác đã cho phép hoặc cùng origin. Không dùng cookie xác thực.

Thành công trả 200 (preflight 204). Lỗi trả `{error,code}`; 400 dữ liệu sai, 401 cần đăng nhập/phiên hết hạn, 403 thiếu quyền/origin bị chặn, 404 không có đối tượng, 409 xung đột, 413 body quá lớn, 415 sai content type, 429 giới hạn yêu cầu, 500 lỗi nội bộ. Lỗi xung đột có kèm snapshot hiện tại. Không trả email/hash mật khẩu/token phiên của người khác.

### Tài khoản và hồ sơ

| Method | Path | Body / kết quả |
| --- | --- | --- |
| GET | `/health` | `{status:'ok',version:1,storage,episodes:{enabled,running,lastStartedAt,lastFinishedAt,lastOutcome}}` |
| POST | `/auth/register` | `{username,email,password}` → `{token,user,profiles}` |
| POST | `/auth/login` | `{identifier,password}` → `{token,user,profiles}`; identifier là username hoặc email |
| GET | `/me` | `{user,profiles}` |
| POST | `/auth/logout` | `{loggedOut:true}`; thu hồi token hiện tại |
| GET | `/profiles` | `{profiles}` |
| POST | `/profiles` | `{name,color:'#aabbcc'}` → `{profile}` |
| PUT | `/profiles/:id` | `{name,color}` → `{profile}` |
| DELETE | `/profiles/:id` | `{deleted:true}` |
| GET | `/profiles/:id/data` | `{revision,data,updatedAt}` |
| PUT | `/profiles/:id/data` | `{revision,data}` → snapshot mới |

`user={id,username,role}`; `profile={id,name,color}`. Tên tài khoản 3–32 chữ/số/`_.-`; mật khẩu 10–128 ký tự. Email chưa có quy trình xác minh hoặc khôi phục mật khẩu; không dùng email tự khai để tự động nâng quyền. Tối đa 6 hồ sơ và luôn giữ ít nhất một. API chỉ cho chủ tài khoản truy cập hồ sơ đó.

`data` được kiểm tra bằng `PersonalData.normalize(data,true)` dùng chung với browser. Body PUT tối đa 3 MiB. PUT phải gửi đúng `revision` đã tải. Hai thiết bị cùng gửi revision cũ chỉ một thiết bị thành công; thiết bị kia nhận 409 `{error,code:'PROFILE_CONFLICT',revision,data,updatedAt}`. Browser hiển thị so sánh/hợp nhất trước khi thử lại bằng revision mới; server không tự ghi đè.

### Cộng đồng

| Method | Path | Body / kết quả |
| --- | --- | --- |
| GET | `/community?slug=X&page=1&limit=20` | `{reviews,average,count,page,ownReview}`; tối đa 30/page |
| POST | `/community` | `{slug,rating:1..5,body,spoiler:boolean}` → `{review}`; đăng nhập |
| DELETE | `/community/:id` | Chính chủ hoặc admin → `{deleted:true}` |
| POST | `/community/:id/report` | `{reason}` → `{reported:true}`; đăng nhập |
| GET | `/admin/reports?page=1` | Admin → `{reports,page}`, tối đa 50/page |
| PATCH | `/admin/reviews/:id` | Admin `{hidden:boolean}` → `{review}`; đóng các report hiện tại |

Review có `{id,slug,username,rating,body,spoiler,createdAt,updatedAt,hidden,mine}`. Một user có một review/phim; POST tiếp theo sửa review của mình. Điểm trung bình chỉ tính review không bị ẩn. Review bị admin ẩn không thể tự sửa để hiện lại; chủ vẫn thấy `ownReview` và có thể xóa. Nội dung tối đa 2000 ký tự; lý do report tối đa 500. Một report đang mở/người/review; không có email trong phản hồi cộng đồng. Phim phải có trong danh mục gốc hoặc overrides.

### Quản trị danh mục

| Method | Path | Body / kết quả |
| --- | --- | --- |
| GET | `/catalog/overrides` | Công khai `{overrides:[{slug,revision,movie,updatedAt}],updatedAt}` |
| GET | `/admin/catalog?slug=X` | `{slug,revision,movie,updatedAt}`; phim gốc revision 0 |
| GET | `/admin/catalog?q=...&page=1&limit=30` | `{movies:[{slug,revision,movie,updatedAt}],page,total}`; tối đa 50/page |
| PUT | `/admin/catalog/:slug` | `{revision,movie}` → snapshot mới; dùng revision 0 để thêm phim |
| GET | `/admin/revisions?slug=X` | `{revisions:[{id,slug,revision,movie,createdAt,actor}]}`; tối đa 50 |
| POST | `/admin/revisions/:id/restore` | `{revision:CURRENT_REVISION}` → snapshot mới; không làm giảm số revision |
| POST | `/admin/episodes/run` | Trả trạng thái rồi chạy nền nếu chưa có lượt đang chạy |
| GET | `/episodes/summary` | Summary nhẹ của lần quét; 404 nếu chưa có kết quả |

Các API `/admin` yêu cầu role admin. `movie` bắt buộc title, year nguyên 1888–2100, episodes 1–10000, type `series|single|animation|tvshows`. Nhận thêm genres, country, sourceCountries, desc, cast, director, poster/banner/remotePoster, source, apiSlug, group, partName, relationOrder, relationVerified và episodeSource. Không nhận stream URL. Ảnh chỉ HTTPS hoặc `Img/` an toàn; body tối đa 64 KiB. Gửi slug trong URL bằng `encodeURIComponent` vì mã cũ có thể chứa `phim/`.

Chỉnh sửa lưu thành override, không sửa file code/archive và không tự push Git. Phiên bản gốc 0 được giữ khi chỉnh sửa lần đầu; tối đa 50 bản/phim, 20000 bản toàn dịch vụ và 5000 phim override. 409 `CATALOG_CONFLICT` kèm bản hiện tại; trang quản trị cần tải lại/so sánh trước khi lưu tiếp.

### Phòng xem chung

| Method | Path | Body / kết quả |
| --- | --- | --- |
| POST | `/rooms` | `{slug,episodeName,episode,source,server,name?}` → snapshot + `memberToken` |
| POST | `/rooms/:id/join` | `{name}` → snapshot + `memberToken` |
| GET | `/rooms/:id` | Snapshot; cần X-Room-Token |
| POST | `/rooms/:id/control` | Host `{revision,playing,time,episodeName,episode,source,server}` → snapshot |
| POST | `/rooms/:id/chat` | `{body}` → snapshot |
| POST | `/rooms/:id/leave` | `{left:true,closed:boolean}`; chủ rời thì đóng phòng |

Snapshot là `{room,members,messages,memberId,isHost}`. `room={id,slug,episodeName,episode,source,server,playing,time,updatedAt,revision}`; `members=[{id,name,isHost}]`; `messages=[{id,name,body,at}]` tối đa 100 tin. Timestamp dùng milliseconds UTC; `time` là seconds tại lần control gần nhất. Browser tự ước lượng vị trí từ updatedAt nếu đang phát. Không gửi URL stream hoặc token qua link mời; link chỉ chứa room ID ngẫu nhiên. Thành viên giữ token riêng, không được đọc token của người khác.

Tối đa 8 người, 2 giờ từ khi tạo; khách không poll/tương tác hơn 120 giây được giải phóng chỗ. Poll 2 giây/lần. Chỉ host control; revision cũ trả 409 `ROOM_CONFLICT` kèm snapshot mới. Room hết hạn/đóng trả 404 `ROOM_NOT_FOUND`; token sai 403 `ROOM_MEMBER_REQUIRED`. Tin nhắn 1–1000 ký tự, cách nhau ít nhất 700 ms. Trình phát iframe của nguồn khác không cho truy cập thời gian nên giao diện cần giải thích giới hạn điều khiển; API chỉ đồng bộ trạng thái, không truyền video.

## Kiểm thử

```powershell
node --test Backend/hub.test.js Frontend/sync-episodes.test.js
```

Kiểm tra HTTP trên cổng tạm, lưu/restart thật, phiên hết hạn/thu hồi, quyền hồ sơ, ghi đồng thời, dữ liệu sai, CORS, giới hạn request, review/moderation, sửa/khôi phục danh mục, host/guest phòng xem, TTL, khóa dữ liệu, lỗi store và lịch quét với provider mô phỏng. Không gọi nguồn phim thật, không gửi email, không tạo dịch vụ cloud.
