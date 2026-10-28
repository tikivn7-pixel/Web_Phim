(function (root) {
  const countries = typeof module !== "undefined" && module.exports ? require("./country-utils") : root.MovieCountries;
  const labels = ["Anime", "Âm Nhạc", "Bí Ẩn", "Chiến Tranh", "Chính Kịch", "Chương Trình Truyền Hình", "Cổ Trang", "Gia Đình", "Giả Tượng", "Hài Hước", "Hành Động", "Hình Sự", "Hoạt Hình", "Học Đường", "Khoa Học", "Kinh Dị", "Kinh Điển", "Lịch Sử", "Miền Tây", "Phá Án", "Phiêu Lưu", "Phim Ngắn", "Tài Liệu", "Tâm Lý", "Thần Thoại", "Thể Thao", "Tình Cảm", "Trẻ Em", "Trinh Thám", "TVShow", "Viễn Tưởng", "Võ Thuật"];
  const byKey = new Map(labels.map(label => [label.toLowerCase(), label]));
  function genres(value) {
    return [...new Set(String(value || "").replace(/Khoa Học\s*Viễn Tưởng/gi, "Khoa Học, Viễn Tưởng")
      .split(/[,;.]/).map(label => label.trim()).filter(label => label && !/^phim\s*18\s*\+$/i.test(label) && !countries.canonical(label))
      .map(label => byKey.get(label.toLowerCase()) || label))];
  }
  const api = { genres };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MovieGenres = api;
})(globalThis);
