# Quản lý nhóm và các phần phim

Mở `Frontend/manage.html` qua URL của website hoặc Live Server, chọn **Nhóm & các phần phim**. Trang này chạy hoàn toàn bằng dữ liệu tĩnh; không cần bật backend. Các thay đổi trong trang quản lý là bản nháp lưu trên trình duyệt của thiết bị đang dùng.

## Chỉnh sửa bằng giao diện

1. Tìm một nhóm bằng tên nhóm, tên phim hoặc slug. Để tạo nhóm mới, nhập tên, mã nhóm cố định và ít nhất một nguồn HTTPS đối chiếu.
2. Tìm và thêm từng phim vào nhóm. Danh sách hiển thị cả năm và slug để phân biệt phim cùng tên. Một phim chỉ thuộc một nhóm chính; phim ở nhóm khác phải được tách ra trước.
3. Nhập nhãn hiển thị cho từng phần và dùng nút ↑ / ↓ để sắp thứ tự. Bản xem trước phản ánh đúng nhãn và thứ tự đó.
4. Bấm **Lưu nhóm** sau khi sửa tên hoặc nguồn. Việc thêm/tách phim, đổi nhãn phần và sắp thứ tự được lưu ngay vào bản nháp.
5. Bấm **Xuất liên kết JSON**. Mỗi nhóm phải có ít nhất hai phim và một nguồn HTTPS hợp lệ. Nhóm chỉ còn một phim cần thêm thành viên hoặc xóa nhóm trước khi xuất.
6. Tại thư mục dự án, chạy:

   ```powershell
   npm run relations:import -- "C:\Users\Admin\Downloads\movie-relations-import.json"
   ```

7. Đăng lại thư mục `Frontend/data` lên hosting, rồi tải lại website. Nếu thêm phim mới trong bản nháp catalog, xuất và chạy `catalog:import` trước, sau đó mới nhập file liên kết chứa phim mới đó.

**Xuất JSON chưa thay đổi website.** Lệnh nhập kiểm tra slug tồn tại, xung đột thành viên, nguồn và thứ tự, lưu bản cũ tại `Backend/movie-relations.manual.json.before-import.bak`, rồi xuất lại dữ liệu công khai. File JSON xuất chứa toàn bộ các nhóm đang chỉnh sửa; lệnh nhập thay thế cấu hình nhóm thủ công bằng file đó. Các nhóm đã nhập được giữ theo lựa chọn của người quản lý; những mùa mới chưa có trong nhóm cần thêm bằng giao diện hoặc cấu hình.

**Tách phim / xóa nhóm không xóa phim.** Slug được thêm vào `standalone`, vì vậy lần chạy `relations:sync` hoặc `catalog:build` sau sẽ không tự nối lại từ metadata. Thêm phim lại vào nhóm bằng giao diện sẽ gỡ loại trừ này. Nếu muốn trả một phim về cơ chế tự động dựa trên ID, xóa slug đó khỏi `standalone` trong file thủ công rồi xây dựng lại.

Hai bản nháp thông tin phim và liên kết được lưu riêng. Nút bỏ bản nháp trong mỗi mục cần xác nhận và chỉ khôi phục dữ liệu mục đó. Trình duyệt cảnh báo khi còn ô nhập chưa lưu hoặc bộ nhớ lưu bản nháp bị chặn/đầy. Các nhãn và nguồn đang gõ phải được lưu trước khi xuất liên kết.

## Các tệp dữ liệu

- `Backend/movie-relations.manual.json`: quyết định được người quản lý xác nhận, dựa trên danh sách slug cụ thể; ưu tiên cao hơn metadata tự động.
- `Backend/relations-cache.json`: metadata đã tải từ nhà cung cấp. Tự động chỉ ghép các mùa có cùng **TMDB TV ID**, không ghép theo từ trong tên.
- `Backend/movie-relations.json`: kết quả hợp nhất được tạo lại khi xây dựng catalog.
- `Frontend/data/movie-relations.json`: bản công khai, chỉ chứa nhóm/thành viên/nguồn, để trang quản lý hoạt động trên hosting tĩnh.
- `Backend/relations-review.md`: các liên kết cũ chưa có bằng chứng, không tự đưa lại vào nhóm.

`group`, `partName`, `relationOrder` và `relationVerified` trong catalog là kết quả sinh ra từ manifest; không sửa các trường này trong `movies.json` hoặc nối nhóm bằng tên. `group` là ID nhóm, còn `partName` là nhãn của **từng slug** trong `members`. Slug của phim đã lưu là mã định danh cố định trong giao diện; thay đổi nguồn xem bằng `apiSlug`.

## Ví dụ cấu hình

```json
{
  "version": 1,
  "groups": [{
    "id": "my-verified-series",
    "label": "Tên loạt phim",
    "sources": ["https://example.com/official-series"],
    "members": [
      { "slug": "slug-phim-thu-nhat", "label": "Mùa 1", "order": 0 },
      { "slug": "slug-phim-thu-hai", "label": "Mùa 2", "order": 1 }
    ]
  }],
  "standalone": []
}
```

Các slug và URL trong ví dụ chỉ minh họa, phải thay bằng phim và nguồn thực tế trước khi nhập.
