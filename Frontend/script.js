// ==========================================
// 0. CẤU HÌNH & DỮ LIỆU TẬP PHIM / DANH SÁCH PHIM
// ==========================================

const API_BASE_URL = "http://localhost:5000";

// ==========================================
// 0D. LẤY LINK TẬP TRỰC TIẾP TỪ API KKPHIM (phimapi.com) THEO SLUG
// ==========================================
// KKPhim (phimapi.com) có API công khai: GET https://phimapi.com/phim/{slug}
// trả về đầy đủ thông tin phim + toàn bộ tập kèm link m3u8 thật.
// Điều kiện: slug phim trong web của bạn phải TRÙNG với slug của KKPhim
// (copy đúng slug từ URL kkphim.com/phim/{slug} khi thêm phim).
// Nhờ vậy không cần lưu/copy tay từng link m3u8 vào DB hay Episodes.js nữa.
const KKPHIM_API_BASE = "https://phimapi.com/phim";

// Gọi API KKPhim theo slug, trả về mảng link m3u8 theo đúng thứ tự tập
// (lấy server đầu tiên trả về, thường là "Vietsub #1").
async function fetchEpisodesFromKKPhim(slug) {
  if (!slug) return [];
  try {
    const res = await fetch(`${KKPHIM_API_BASE}/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`API KKPhim lỗi ${res.status}`);
    const data = await res.json();
    const servers = data.episodes || [];
    if (!servers.length) return [];
    return (servers[0].server_data || []).map((ep) => ep.link_m3u8 || "");
  } catch (err) {
    console.error("Lỗi lấy danh sách tập từ KKPhim API:", err);
    return [];
  }
}

// Lấy đúng 1 link tập theo số thứ tự (episodeNum bắt đầu từ 1)
async function fetchEpisodeUrlFromKKPhim(slug, episodeNum) {
  const urls = await fetchEpisodesFromKKPhim(slug);
  return urls[episodeNum - 1] || "";
}

// Ghi chú: Episodes.js / window.allEpisodesData vẫn được nạp trong index.html
// để tương thích ngược với watch.html/detail.html (đang dùng bản cũ), nhưng
// TRANG CHỦ (index.html) giờ không còn phụ thuộc vào nó nữa — toàn bộ số tập
// đã được lưu đúng trong cột total_episodes ở MySQL rồi.
function getTotalEpisodes(movie) {
  return movie && movie.episodes ? movie.episodes : 20;
}

const IMG_BASE = "Img/";
// Danh sách phim hardcode dùng làm DỰ PHÒNG (fallback) khi API MySQL lỗi
// hoặc chưa kịp tải xong. Danh sách chính thức, hiển thị hàng ngày vẫn là
// globalMoviesList (được merge thêm dữ liệu thật từ MySQL bên dưới).
const fallbackMoviesList = [
  {
    title: "Twenty Five Twenty One",
    slug: "tuoi-hai-lam-tuoi-hai-mot",
    episodes: 16,
    genres: "Tình Cảm, Học Đường, Chính Kịch, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "2521.jpg",
    banner: IMG_BASE + "2521.jpg",
    desc: "Tại thời điểm mà những ước mơ dường như xa tầm với, một kiếm sĩ tuổi teen theo đuổi những hoài bão lớn và gặp một chàng trai chăm chỉ đang tìm cách làm lại cuộc đời.",
  },
  {
    title: "Queen of Tears",
    slug: "nu-hoang-nuoc-mat",
    episodes: 16,
    genres: "Tình Cảm, Chính Kịch, Hài Hước, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "QueenOfTears.jpg",
    banner: IMG_BASE + "QueenOfTears.jpg",
    desc: "Cuộc sống hôn nhân sóng gió nhưng đầy cảm xúc của cặp vợ chồng tài phiệt.",
  },
  {
    title: "Mouse",
    slug: "mouse-ke-san-nguoi-ban-dien-anh",
    episodes: 20,
    genres: "Bí Ẩn, Hình Sự, Kinh Dị, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Mouse.jpg",
    banner: IMG_BASE + "Mouse.jpg",
    desc: "Thước phim trinh thám giật gân xoay quanh kẻ sát nhân biến thái.",
  },
  {
    title: "Moving",
    slug: "doi-thieu-nien-sieu-dang",
    episodes: 20,
    genres: "Hành Động, Viễn Tưởng, Thần Thoại, Phiêu Lưu, Hàn Quốc",
    poster: IMG_BASE + "Moving.jpg",
    banner: IMG_BASE + "Moving.jpg",
    desc: "Những siêu anh hùng ẩn giấu thân phận để bảo vệ gia đình.",
  },
  {
    title: "Can This Love Be Translated?",
    slug: "tieng-yeu-nay-anh-dich-duoc-khong",
    episodes: 12,
    genres: "Tình Cảm, Hài Hước, Hàn Quốc",
    poster: IMG_BASE + "Can_This_Love_Be_Translated.png",
    banner: IMG_BASE + "Can_This_Love_Be_Translated.png",
    desc: "Câu chuyện về những phiên dịch viên và ranh giới mong manh giữa công việc và tình cảm.",
  },
  {
    title: "My Liberation Notes",
    slug: "nhat-ky-tu-do-cua-toi",
    episodes: 16,
    genres: "Chính Kịch, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Nhat_ky_tu_do_cua_toi.jpg",
    banner: IMG_BASE + "Nhat_ky_tu_do_cua_toi.jpg",
    desc: "Ba anh chị em ở ngoại ô Seoul đi tìm sự giải thoát cho chính cuộc đời mình.",
  },
  {
    title: "Resident Playbook",
    slug: "chuyen-doi-bac-si-noi-tru",
    episodes: 12,
    genres: "Chính Kịch. Tình Cảm, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Chuyện Đời Bác Sĩ Nội Trú.jpg",
    banner: IMG_BASE + "Chuyện Đời Bác Sĩ Nội Trú.jpg",
    desc: "Nhật ký hài hước và chân thực của các bác sĩ nội trú tại bệnh viện.",
  },
  {
    title: "Teach You a Lesson",
    slug: "bai-hoc-dang-doi",
    episodes: 10,
    genres: "Hành Động, Hình Sự, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "Teach You a Lesson.jpg",
    banner: IMG_BASE + "Teach You a Lesson.jpg",
    desc: "Hành trình đấu tranh giành lại công bằng đầy kịch tính.",
  },
  {
    title: "The Wonderfools",
    slug: "biet-doi-sieu-kho",
    episodes: 8,
    genres: "Hài Hước, Tâm Lý, Phiêu Lưu, Hàn Quôcs",
    poster: IMG_BASE + "wonderfools.jpg",
    banner: IMG_BASE + "wonderfools.jpg",
    desc: "Nhóm bạn với những giấc mơ dang dở cùng nhau vượt qua thử thách cuộc sống.",
  },
  {
    title: "We Are Trying Here",
    slug: "cuoc-chien-trong-chung-ta",
    episodes: 12,
    genres: "Tình Cảm, Tâm Lý, Gia Đình, Hàn Quốc",
    poster: IMG_BASE + "We Are All Trying Here.jpg",
    banner: IMG_BASE + "We Are All Trying Here.jpg",
    desc: "Câu chuyện ấm áp về những con người đang cố gắng hết mình mỗi ngày.",
  },
  {
    title: "Our Beloved Summer",
    slug: "mua-he-yeu-dau-cua-chung-ta-nhung-ngay-he-ruc-nang-cua-chung-minh",
    episodes: 16,
    genres: "Tình Cảm, Hài Hước, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Our Beloved Summer.jpg",
    banner: IMG_BASE + "Our Beloved Summer.jpg",
    desc: "Tình yêu nhẹ nhàng, sâu lắng qua những thước phim tài liệu thanh xuân.",
  },
  {
    title: "Twinkling Watermelon",
    slug: "dua-hau-lap-lanh",
    episodes: 16,
    genres: "Tình Cảm, Âm Nhạc, Học Đường, Viễn Tưởng, Hàn Quốc",
    poster: IMG_BASE + "twinkling watermelon.jpg",
    banner: IMG_BASE + "twinkling watermelon.jpg",
    desc: "Hành trình xuyên không về quá khứ qua một cửa hàng nhạc cụ kỳ lạ.",
  },
  {
    title: "weathering with you",
    slug: "dua-con-cua-thoi-tiet",
    episodes: 1,
    genres: "Hoạt Hình, Viễn Tưởng, Tình Cảm, Phim Ngắn, Anime",
    poster: IMG_BASE + "weathering with you.jpg",
    banner: IMG_BASE + "weathering with you.jpg",
    desc: "Xoay quanh cuộc sống của cậu thiếu niên Morishima Hodaka...",
  },
  {
    title: "The Witch: Part 1. The Subversion",
    slug: "sat-thu-nhan-tao",
    episodes: 1,
    genres: "Hành Động, Bí Ẩn, Khoa Học, Kinh Dị, Hàn Quốc",
    poster: IMG_BASE + "TheWitch1.jpg",
    banner: IMG_BASE + "TheWitch1.jpg",
    desc: "Sát Thủ Nhân Tạo là bộ phim hành động li kì kể về Koo Ja-yoon...",
    group: "sat-thu-nhan-tao",
    partName: "Phần 1",
  },
  {
    title: "The Witch: Part 2. The Other One",
    slug: "sat-thu-nhan-tao-2-mau-vat-con-lai",
    episodes: 1,
    genres: "Hành Động, Bí Ẩn, Khoa Học, Kinh Dị, Hàn Quốc",
    poster: IMG_BASE + "TheWitch2.jpg",
    banner: IMG_BASE + "TheWitch2.jpg",
    desc: "Lợi dụng sự cố kinh hoàng tại cơ sở thí nghiệm, cô nàng 17 tuổi...",
    group: "sat-thu-nhan-tao",
    partName: "Phần 2",
  },
  {
    title: "agent kim reactivated",
    slug: "dac-vu-kim-tai-khoi-dong",
    episodes: 10,
    genres: "Hành Động, Hình Sự, Võ Thuật, Hàn Quốc",
    poster: IMG_BASE + "AgentKimReactivated.jpg",
    banner: IMG_BASE + "AgentKimReactivated.jpg",
    desc: "Một ông bố yêu con từng là lính đặc nhiệm đáng gờm...",
  },
  {
    title: "all of us are dead",
    slug: "ngoi-truong-xac-song",
    episodes: 12,
    genres:
      "Chính kịch, Viễn Tưởng, Phiêu Lưu, Hành Động, Khoa Học,  Học Đường, Hàn Quốc",
    poster: IMG_BASE + "All of Us Are Dead.jpg",
    banner: IMG_BASE + "All of Us Are Dead.jpg",
    desc: "Một trường cấp ba trở thành điểm bùng phát virus thây ma. Các học sinh mắc kẹt phải nỗ lực thoát ra – hoặc biến thành một trong những người nhiễm bệnh hung tợn.",
  },
  {
    title: "Naruto",
    slug: "naruto",
    episodes: 220,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto.jpg",
    banner: IMG_BASE + "Naruto.jpg",
    desc: "Bộ phim kể về cậu về quá trình lớn lên và cuộc đời của cậu bé những nguy hiểm mà cậu đã gặp phải kèm theo đó là một động lực và niềm tin phi thường , một tâm hồn trong sáng chứa đựng những trò nghịch ngợm bướng bỉnh nhưng đầy hồn nhiên . Cùng với việc xoay quanh những người đã bỏ mạng do tranh giành quyền lực cộng với sự đau thương , mất mát mà Naruto đã trải qua.",
    group: "naruto",
    partName: "naruto",
  },
  {
    title: "Naruto the Movie: Ninja Clash in the Land of Snow",
    slug: "naruto-cuoc-chien-o-tuyet-quoc",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto the Movie Ninja Clash in the Land of Snow.jpg",
    banner: IMG_BASE + "Naruto the Movie Ninja Clash in the Land of Snow.jpg",
    desc: "Naruto the Movie: Ninja Clash in the Land of Snow",
    group: "naruto",
    partName: "Movie 1",
  },
  {
    title: "Naruto the Movie: Legend of the Stone of Gelel",
    slug: "naruto-huyen-thoai-da-gelel",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto the Movie Legend of the Stone of Gelel.jpg",
    banner: IMG_BASE + "Naruto the Movie Legend of the Stone of Gelel.jpg",
    desc: "Naruto the Movie: Legend of the Stone of Gelel",
    group: "naruto",
    partName: "Movie 2",
  },
  {
    title: "Naruto the Movie: Guardians of the Crescent Moon Kingdom",
    slug: "naruto-nhung-linh-gac-cua-nguyet-quoc",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster:
      IMG_BASE + "Naruto the Movie Guardians of the Crescent Moon Kingdom.jpg",
    banner:
      IMG_BASE + "Naruto the Movie Guardians of the Crescent Moon Kingdom.jpg",
    desc: "Naruto the Movie: Guardians of the Crescent Moon Kingdom",
    group: "naruto",
    partName: "Movie 3",
  },
  {
    title: "naruto shippuden",
    slug: "naruto-shippuden",
    episodes: 500,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippuden.jpg",
    banner: IMG_BASE + "Naruto Shippuden.jpg",
    desc: "Naruto Shippuden hay còn được gọi với cái tên quen thuộc Naruto phần 2 là phần tiếp theo của bộ phim hoạt hình nổi tiếng Naruto, lấy bối cảnh hai năm rưỡi sau khi Naruto rời làng Lá. Naruto Shippuden tiếp tục theo chân chàng ninja trẻ tuổi Naruto Uzumaki trong cuộc hành trình luyện tập cực khổ để trở thành ninja giỏi nhất. Trong khi đó, Akatsuki, một tổ chức bí ẩn tập hợp những ninja phản diện tài giỏi bậc nhất, đang từng bước thực hiện kế hoạch lớn của chúng, đe dọa sự an toàn của thế giới ninja. Naruto sẽ làm gì để bảo vệ làng Lá và những người mà cậu yêu quý?",
    group: "naruto",
    partName: "naruto shippuden",
  },
  {
    title: "Naruto Shippuden the Movie",
    slug: "naruto-shippden-cai-chet-tien-doan",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippuden the Movie.jpg",
    banner: IMG_BASE + "Naruto Shippuden the Movie.jpg",
    desc: "Naruto Shippuden the Movie",
    group: "naruto",
    partName: "Movie 4",
  },
  {
    title: "Naruto Shippuden the Movie: Bonds",
    slug: "naruto-shippden-nhiem-vu-bi-mat",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippuden the Movie Bonds.jpg",
    banner: IMG_BASE + "Naruto Shippuden the Movie Bonds.jpg",
    desc: "Naruto Shippuden the Movie: Bonds",
    group: "naruto",
    partName: "Movie 5",
  },
  {
    title: "Naruto Shippuden the Movie: The Will of Fire",
    slug: "naruto-shippden-nguoi-ke-thua-hoa-chi",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippuden the Movie The Will of Fire.jpg",
    banner: IMG_BASE + "Naruto Shippuden the Movie The Will of Fire.jpg",
    desc: "Naruto Shippuden the Movie: The Will of Fire",
    group: "naruto",
    partName: "Movie 6",
  },
  {
    title: "Naruto Shippūden: The Lost Tower",
    slug: "naruto-shippden-toa-thap-bi-mat",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippūden The Lost Tower.jpg",
    banner: IMG_BASE + "Naruto Shippūden The Lost Tower.jpg",
    desc: "Naruto Shippūden: The Lost Tower",
    group: "naruto",
    partName: "Movie 7",
  },
  {
    title: "Naruto Shippuden the Movie: Blood Prison",
    slug: "naruto-shippden-huyet-nguc",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Naruto Shippuden the Movie Blood Prison.jpg",
    banner: IMG_BASE + "Naruto Shippuden the Movie Blood Prison.jpg",
    desc: "Naruto Shippuden the Movie: Blood Prison",
    group: "naruto",
    partName: "Movie 8",
  },
  {
    title: "ROAD TO NINJA -NARUTO THE MOVIE",
    slug: "naruto-duong-toi-ninja",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "ROAD TO NINJA -NARUTO THE MOVIE.jpg",
    banner: IMG_BASE + "ROAD TO NINJA -NARUTO THE MOVIE.jpg",
    desc: "ROAD TO NINJA -NARUTO THE MOVIE",
    group: "naruto",
    partName: "Movie 9",
  },
  {
    title: "The Last: Naruto the Movie",
    slug: "naruto-tran-chien-cuoi-cung",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "The Last Naruto the Movie.jpg",
    banner: IMG_BASE + "The Last Naruto the Movie.jpg",
    desc: "The Last: Naruto the Movie",
    group: "naruto",
    partName: "Movie 10",
  },
  {
    title: "Boruto: Naruto The Movie",
    slug: "boruto-naruto-the-movie",
    episodes: 1,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Boruto Naruto The Movie.jpg",
    banner: IMG_BASE + "Boruto Naruto The Movie.jpg",
    desc: "Boruto Naruto The Movie",
    group: "boruto",
    partName: "Movie",
  },
  {
    title: "Boruto: Naruto Next Generations",
    slug: "boruto-naruto-hau-sinh-kha-uy",
    episodes: 293,
    genres: "Hoạt Hình, Anime, Võ Thuật",
    poster: IMG_BASE + "Boruto Naruto Next Generations.jpg",
    banner: IMG_BASE + "Boruto Naruto Next Generations.jpg",
    desc: "Boruto: Naruto Next Generations",
    group: "boruto",
    partName: "Boruto",
  },
  {
    title: "vincenzo",
    slug: "vincenzo",
    episodes: 20,
    genres: "Hành Động, Phiêu Lưu, Hài Hước, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "Vincenzo.jpg",
    banner: IMG_BASE + "Vincenzo.jpg",
    desc: "Vincenzo là câu chuyện kể về một luật sư mafia người Ý gốc Hàn trốn về Hàn Quốc sau khi bị tổ chức phản bội. Khi trở lại quê hương, anh tham gia quét sạch kẻ xấu theo đúng cách của một người xấu cùng luật sư Hong Cha-yong.",
  },
  {
    title: "Hunt",
    slug: "san-lung-gian-diep",
    episodes: 1,
    genres: "Hành Động, Bí Ẩn, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Hunt.jpg",
    banner: IMG_BASE + "Hunt.jpg",
    desc: "Hunt lấy bối cảnh Hàn Quốc thập niên 1980, giai đoạn mà chính quyền quân sự nước này siết chặt các vấn đề liên quan đến chiến lược an ninh quốc gia. Nhân vật chính của phim là hai hai điệp viên Hàn Quốc (Lee Jung Jae và Jung Woo Sung) nhận nhiệm vụ lật mặt một gián điệp Triều Tiên trong tổ chức của mình. Trong quá trình làm nhiệm vụ, họ đã nảy sinh nghi ngờ và bắt đầu điều tra lẫn nhau.cd",
  },
  {
    title: "Money Heist: Korea - Joint Economic Area",
    slug: "phi-vu-trieu-do-han-quoc",
    episodes: 12,
    genres: "Hành Động, Bí Ẩn, Phiêu Lưu, Hình Sự, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "Money Heist Korea.jpg",
    banner: IMG_BASE + "Money Heist Korea.jpg",
    desc: "Giáo sư (Yoo Ji-Tae) lên kế hoạch cho một vụ trộm đầy tham vọng sẽ có một khoản tiền lớn. Đối với kế hoạch của mình, Giáo sư tìm kiếm các thành viên tiềm năng trong nhóm. Các thành viên được tuyển chọn chọn tên thành phố làm mật danh và họ đều có cá tính mạnh mẽ. Kế hoạch của họ có vẻ hoàn hảo, nhưng do bắt giữ các con tin, họ phải đối mặt với một tình huống bất ngờ.",
  },
  {
    title: "Itaewon Class",
    slug: "tang-lop-itaewon",
    episodes: 16,
    genres: "Chính Kịch, Tâm Lý, Tình Cảm, Hàn Quốc",
    poster: IMG_BASE + "Itaewon Class.jpg",
    banner: IMG_BASE + "Itaewon Class.jpg",
    desc: "Tại một khu phố nhộn nhịp của Seoul, một cựu tù nhân và bạn bè mình chiến đấu với đối thủ khó nhằn để biến tham vọng quán bar đường phố của họ thành hiện thực.",
  },
  {
    title: "Nine Puzzles",
    slug: "chin-manh-ghep-bi-an",
    episodes: 11,
    genres: "Hình Sự, Bí Ẩn, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Nine Puzzles.jpg",
    banner: IMG_BASE + "Nine Puzzles.jpg",
    desc: "Nine Puzzles là bộ phim thuộc thể loại hình sự, phá án, kinh dị kể về hành trình truy tìm hung thủ vụ án giết người hàng loạt xảy ra 10 năm về trước nay lại tái diễn. Yoon Yi Na (Kim Da Mi thủ vai) là nhân chứng duy nhất trong vụ án 10 năm trước khi người chú ruột của cô bị sát hại. Sau này, cô trở thành trung úy cảnh sát 6 năm kinh nghiệm trong lĩnh vực lập hồ sơ phân tích tội phạm thuộc Đội phân tích tội phạm - Phòng Điều tra pháp y thuộc Cơ quan cảnh sát thành phố Seoul, với bộ não thiên tài, Yina nắm bắt rất nhanh động cơ phạm tội của hung thủ tại hiện trường như thể đã từng thực hiện. Cùng lật lại vụ án, truy tìm hung thủ giết người hàng loạt xảy ra 10 năm trước cùng với Yina là cảnh sát điều tra đội phòng chống bạo lực Kim Han Saem (Son Seok Gu thủ vai), người luôn nghi ngờ Yina chính là hung thủ của vụ án 10 năm trước. Han Saem là cảnh sát ưu tú, lỳ lợm và nhạy bén nhưng lại khiến cho người ta hiểu lầm bởi những hành động có phần quái dị của mình. Để ngăn chặn số lượng nạn nhân bị gi.ết hại ngày một tăng cùng với sự xuất hiện của “mảnh ghép bí ẩn”, Yina phải cùng bắt tay với Han Saem để nhanh chóng tìm ra hung thủ thật sự.",
  },
  {
    title: "20th Century Girl",
    slug: "co-gai-the-ky-20",
    episodes: 1,
    genres: "Tình Cảm, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "20th Century Girl.jpg",
    banner: IMG_BASE + "20th Century Girl.jpg",
    desc: "Cô Gái Thế Kỷ 20 kể về năm 1999, một cô nàng tuổi teen theo dõi sát sao một nam sinh trong trường thay cho cô bạn thân si tình. Nhưng rồi, chính cô lại bị cuốn vào câu chuyện tình của riêng mình",
  },
  {
    title: "Duty After School",
    slug: "hoc-ky-sinh-tu",
    episodes: 10,
    genres: "Tình Cảm, Chính Kịch, Tâm Lý, Hành Động, Học Đường, Hàn Quốc",
    poster: IMG_BASE + "Duty After School.jpg",
    banner: IMG_BASE + "Duty After School.jpg",
    desc: "Học Kỳ Sinh Tử – Duty After School (2023) dựa trên webcomic “Duty After School” của Ha Il-Kwon, lấy bối cảnh Hàn Quốc bị tấn công bởi những sinh vật lạ từ trên trời rơi xuống, gây ra thảm họa thương vong toàn quốc. Để giúp đỡ các lực lượng quân sự, chính phủ Hàn chỉ định tất cả các sinh viên cũng như học sinh trung học phải trở thành quân dự bị. Thay vì ngòi bút, nay học sinh Hàn Quốc phải cầm vũ khí để tiêu diệt những sinh vật này.",
  },
  {
    title: "Study Group",
    slug: "hoc-sinh-ca-biet",
    episodes: 10,
    genres: "Tình Cảm, Hài Hước, Tâm Lý, Hành Động, học Đường, Hàn Quốc",
    poster: IMG_BASE + "Study Group.jpg",
    banner: IMG_BASE + "Study Group.jpg",
    desc: "Học Sinh Cá Biệt xoay quanh hành trình vươn lên trong học tập đầy cam go của cậu học sinh chỉ giỏi đánh nhau Yun Ga Min. Học tại một trường trung học đầy tai tiếng với thành phần học sinh đa số thuộc diện cá biệt, Ga Min vẫn nuôi quyết tâm cải thiện học lực để có thể vào được đại học. Để đạt được mục tiêu này, cậu thành lập một nhóm học tập với một nhóm bạn học đa dạng. Cùng nhau, họ đối mặt với những thử thách trong cuộc sống học đường, bao gồm áp lực học hành, nạn bắt nạt và đủ thứ vấn đề khác của tuổi mới lớn.",
  },
  {
    title: "Detective Conan",
    slug: "tham-tu-lung-danh-conan",
    episodes: 1214,
    genres: "Hài Hước, Phá Án, Trinh Thám, Anime",
    poster: IMG_BASE + "Detective Conan.jpg",
    banner: IMG_BASE + "Detective Conan.jpg",
    desc: "Phim hoạt hình Conan bắt đầu sau vụ việc xảy ra tại công viên giải trí nổi tiếng Tropical Land tại khu tàu lượn siêu tốc. Kudo đang điều tra một trong hai người đàn ông có vẻ ngoài khả nghi được cho là nghi phạm trong vụ việc. Anh ta bị tấn công bởi một trong số họ có mật danh là Gin và đồng đội của anh ta tên là Vodka. Sau khi đánh Shinichi, Gin đã đưa cho anh ta một loại thuốc mà sau này được gọi là APTX 4869 để giết anh ta. Trên thực tế, chất độc có một tác dụng phụ hiếm gặp, biến Shinichi từ một cơ thể trưởng thành thành một đứa trẻ thay vì giết chết. Sau sự cố quan trọng, Shinichi về nhà và lấy tên là Conan Edogawa sau khi bị người bạn thời thơ ấu Ran gây áp lực. Shinichi đã cố gắng che giấu danh tính bí mật của mình với những người anh quan tâm để điều tra về tổ chức Áo Đen.",
    group: "Conan",
    partName: "Detective Conan",
  },
  {
    title: "Weak Hero Class 1",
    slug: "nguoi-hung-yeu-duoi",
    episodes: 8,
    genres: "Chính Kịch, Học Đường, Hành Động, Hàn Quốc",
    poster: IMG_BASE + "Weak Hero Class 1.jpg",
    banner: IMG_BASE + "Weak Hero Class 1.jpg",
    desc: "Tại một ngôi trường chìm trong chế độ phân cấp bạo lực, thiếu niên trầm tính nọ đã thách thức hiện trạng này, mạo hiểm tất cả để bảo vệ những người bạn đáng để cậu chiến đấu.",
    group: "weak-hero",
    partName: "Weak Hero Class 1",
  },
  {
    title: "Weak Hero Class 2",
    slug: "nguoi-hung-yeu-duoi-2",
    episodes: 8,
    genres: "Chính Kịch, Học Đường, Hành Động, Hàn Quốc",
    poster: IMG_BASE + "Weak Hero Class 2.jpg",
    banner: IMG_BASE + "Weak Hero Class 2.jpg",
    desc: "Tại một ngôi trường chìm trong chế độ phân cấp bạo lực, thiếu niên trầm tính nọ đã thách thức hiện trạng này, mạo hiểm tất cả để bảo vệ những người bạn đáng để cậu chiến đấu.",
    group: "weak-hero",
    partName: "Weak Hero Class 2",
  },
  {
    title: "Gyeongseong Creature (Season 1)",
    slug: "sinh-vat-gyeongseong-phan-1",
    episodes: 10,
    genres: "Khoa Học, Viễn Tưởng, Bí Ẩn, Hành Động, Hàn Quốc",
    poster: IMG_BASE + "Gyeongseong Creature (Season 1).jpg",
    banner: IMG_BASE + "Gyeongseong Creature (Season 1).jpg",
    desc: "Ở Gyeongseong năm 1945, giữa thời kỳ Seoul bị thực dân thống trị, một doanh nhân và một do thám chiến đấu để sinh tồn và đối mặt với quái vật sinh ra từ lòng tham của con người.",
    group: "Gyeongseong",
    partName: "Gyeongseong Creature 1",
  },
  {
    title: "Gyeongseong Creature (Season 2)",
    slug: "sinh-vat-gyeongseong-phan-2",
    episodes: 10,
    genres: "Khoa Học, Viễn Tưởng, Bí Ẩn, Hành Động, Hàn Quốc",
    poster: IMG_BASE + "Gyeongseong Creature (Season 1).jpg",
    banner: IMG_BASE + "Gyeongseong Creature (Season 1).jpg",
    desc: "Ở Gyeongseong năm 1945, giữa thời kỳ Seoul bị thực dân thống trị, một doanh nhân và một do thám chiến đấu để sinh tồn và đối mặt với quái vật sinh ra từ lòng tham của con người.",
    group: "Gyeongseong",
    partName: "Gyeongseong Creature 2",
  },
  {
    title: "Our Unwritten Seoul",
    slug: "mot-seoul-chua-biet-den",
    episodes: 12,
    genres: "Hài Hước, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "our unwritten seoul.jpg",
    banner: IMG_BASE + "our unwritten seoul.jpg",
    desc: "Our Unwritten Seoul",
  },
  {
    title: "Agents Of Mystery (Season 1)",
    slug: "doi-dac-vu-pha-an-phan-1",
    episodes: 6,
    genres: "TVShow, Chính Kịch, Tâm lý, Hàn Quốc",
    poster: IMG_BASE + "Agents Of Mystery (Season 1).jpg",
    banner: IMG_BASE + "Agents Of Mystery (Season 1).jpg",
    desc: "Sáu đặc vụ bí ẩn với sự phối hợp ăn ý tuyệt vời cùng nhau điều tra những vụ việc kỳ quái, không thể giải thích bằng khoa học theo những cách sáng tạo và độc đáo nhất.",
    group: "Agents",
    partName: "Agents Of Mystery 1",
  },
  {
    title: "Agents Of Mystery (Season 2)",
    slug: "doi-dac-vu-pha-an-phan-2",
    episodes: 6,
    genres: "TVShow, Chính Kịch, Tâm lý, Hàn Quốc",
    poster: IMG_BASE + "Agents Of Mystery (Season 2).jpg",
    banner: IMG_BASE + "Agents Of Mystery (Season 2).jpg",
    desc: "Sáu đặc vụ bí ẩn với sự phối hợp ăn ý tuyệt vời cùng nhau điều tra những vụ việc kỳ quái, không thể giải thích bằng khoa học theo những cách sáng tạo và độc đáo nhất.",
    group: "Agents",
    partName: "Agents Of Mystery 2",
  },
  {
    title: "Badly In Love 1",
    slug: "tinh-yeu-noi-loan-phan-1",
    episodes: 10,
    genres: "TVShow, Chính Kịch, Tâm lý, Nhật Bản",
    poster: IMG_BASE + "Badly In Love (Season 1).jpg",
    banner: IMG_BASE + "Badly In Love (Season 1).jpg",
    desc: "Series hẹn hò của Nhật Bản dành cho những trẻ trâu nổi loạn,",
    group: "badlyinlove",
    partName: "Badly In Love 1",
  },
  {
    title: "Badly In Love 2",
    slug: "tinh-yeu-noi-loan-phan-2",
    episodes: 20,
    genres: "TVShow, Chính Kịch, Tâm lý, Nhật Bản",
    poster: IMG_BASE + "Badly In Love (Season 2).jpg",
    banner: IMG_BASE + "Badly In Love (Season 2).jpg",
    desc: "Series hẹn hò của Nhật Bản dành cho những trẻ trâu nổi loạn,",
    group: "badlyinlove",
    partName: "Badly In Love 2",
  },
  {
    title: "True Beauty",
    slug: "ve-dep-dich-thuc",
    episodes: 16,
    genres: "Hài Hước, Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "True Beauty.jpg",
    banner: IMG_BASE + "True Beauty.jpg",
    desc: "Vẻ Đẹp Đích Thực xoay quanh nhân vật chính là Im Joo Kyung. Cô là một nữ sinh có ngoại hình tầm thường và luôn mặc cảm về khuôn mặt mình. Tuy nhiên kể từ khám phá ra năng khiếu trang điểm của bản thân, Joo Kyung lột xác thành một hotgirl xinh đẹp và nổi tiếng trên MXH. Kéo theo muôn vàn rắc rối bi hài khi cô vừa phải tìm cách che giấu khuôn mặt thật, vừa phải giữ được hình tượng lung linh trước mọi người. Cùng lúc đó, 2 chàng trai “đẹp hơn hoa” lại vướng vào lưới tình với Joo Kyun. Một bên là Lee Suho, con trai của diễn viên điện ảnh nổi tiếng nhưng lại che giấu mình dưới vỏ bọc nam sinh gương mẫu ở trường. Bên còn lại là Han Seo Joon, một anh chàng người mẫu cá tính, táo bạo.",
  },
  {
    title: "Alchemy Of Souls 1",
    slug: "hoan-hon-phan-1",
    episodes: 20,
    genres: "Bí Ẩn, Chính Kịch, Hành Động, Phiêu Lưu, Viễn Tưởng, Hàn Quốc",
    poster: IMG_BASE + "Alchemy Of Souls.jpg",
    banner: IMG_BASE + "Alchemy Of Souls.jpg",
    desc: "Alchemy Of Souls",
    group: "AlchemyOfSouls",
    partName: "Alchemy Of Souls 1",
  },
  {
    title: "Alchemy Of Souls 2",
    slug: "hoan-hon-phan-2",
    episodes: 10,
    genres: "Bí Ẩn, Chính Kịch, Hành Động, Phiêu Lưu, Viễn Tưởng, Hàn Quốc",
    poster: IMG_BASE + "Alchemy Of Souls.jpg",
    banner: IMG_BASE + "Alchemy Of Souls.jpg",
    desc: "Alchemy Of Souls",
    group: "AlchemyOfSouls",
    partName: "Alchemy Of Souls 2",
  },
  {
    title: "Pyramid Game",
    slug: "tro-choi-kim-tu-thap",
    episodes: 10,
    genres: "Chính Kịch, Hàn Quốc",
    poster: IMG_BASE + "Pyramid Game.jpg",
    banner: IMG_BASE + "Pyramid Game.jpg",
    desc: "Pyramid Game",
  },
  {
    title: "One Piece",
    slug: "dao-hai-tac",
    episodes: 2000,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece.jpg",
    banner: IMG_BASE + "One Piece.jpg",
    desc: "One Piece",
    group: "One Piece",
    partName: "Phần TV Series",
  },
  {
    title: "One Piece: The Movie",
    slug: "dao-hai-tac-1-dao-chau-bau",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece The Movie.jpg",
    banner: IMG_BASE + "One Piece The Movie.jpg",
    desc: "One Piece: The Movie",
    group: "One Piece",
    partName: "Movie 1",
  },
  {
    title: "One Piece: Clockwork Island Adventure",
    slug: "dao-hai-tac-2-cuoc-phieu-luu-tren-dao-dong-ho",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Clockwork Island Adventure.jpg",
    banner: IMG_BASE + "One Piece Clockwork Island Adventure.jpg",
    desc: "One Piece: Clockwork Island Adventure",
    group: "One Piece",
    partName: "Movie 2",
  },
  {
    title: "One Piece: Dead End Adventure",
    slug: "dao-hai-tac-4-cuoc-dua-tu-than",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Dead End Adventure.jpg",
    banner: IMG_BASE + "One Piece Dead End Adventure.jpg",
    desc: "One Piece: Dead End Adventure",
    group: "One Piece",
    partName: "Movie 4",
  },
  {
    title: "One Piece: Mamore! Saigo no Dai Butai",
    slug: "vua-hai-tac-bao-ve-vo-dien-lon-cuoi-cung",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Mamore! Saigo no Dai Butai.jpg",
    banner: IMG_BASE + "One Piece Mamore! Saigo no Dai Butai.jpg",
    desc: "One Piece: Mamore! Saigo no Dai Butai",
    group: "One Piece",
    partName: "Ova Movie 4",
  },
  {
    title: "One Piece: Oounabara Ni Hirake! Dekkai Dekkai Chichi No Yume!",
    slug: "vua-hai-tac-vuon-ra-dai-duong-giac-mo-to-lon-cua-bo",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster:
      IMG_BASE +
      "One Piece Oounabara Ni Hirake! Dekkai Dekkai Chichi No Yume!.jpg",
    banner:
      IMG_BASE +
      "One Piece Oounabara Ni Hirake! Dekkai Dekkai Chichi No Yume!.jpg",
    desc: "One Piece: Oounabara Ni Hirake! Dekkai Dekkai Chichi No Yume!",
    group: "One Piece",
    partName: "TV Special 3",
  },
  {
    title: "One Piece: Curse Of The Sacred Sword",
    slug: "dao-hai-tac-5-loi-nguyen-thanh-kiem",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Curse Of The Sacred Sword.jpg",
    banner: IMG_BASE + "One Piece Curse Of The Sacred Sword.jpg",
    desc: "One Piece: Curse Of The Sacred Sword",
    group: "One Piece",
    partName: "Movie 5",
  },
  {
    title: "One Piece: Karakuri shiro no Mecha Kyohei",
    slug: "dao-hai-tac-7-ten-khong-lo-trong-lau-dai-karakuri",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Karakuri shiro no Mecha Kyohei.jpg",
    banner: IMG_BASE + "One Piece Karakuri shiro no Mecha Kyohei.jpg",
    desc: "One Piece: Karakuri shiro no Mecha Kyohei",
    group: "One Piece",
    partName: "Movie 7",
  },
  {
    title:
      "One Piece: The Desert Princess and the Pirates: Adventure in Alabasta",
    slug: "dao-hai-tac-8-cuoc-chien-o-vuong-quoc-alabasta",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster:
      IMG_BASE +
      "One Piece The Desert Princess and the Pirates Adventure in Alabasta.jpg",
    banner:
      IMG_BASE +
      "One Piece The Desert Princess and the Pirates Adventure in Alabasta.jpg",
    desc: "One Piece: The Desert Princess and the Pirates: Adventure in Alabasta",
    group: "One Piece",
    partName: "Movie 8",
  },
  {
    title:
      "One Piece: Episode of Chopper Plus: Bloom in the Winter, Miracle Cherry Blossom",
    slug: "dao-hai-tac-9-no-vao-mua-dong-hoa-sakura-dieu-ky",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster:
      IMG_BASE +
      "One Piece Episode of Chopper Plus Bloom in the Winter, Miracle Cherry Blossom.jpg",
    banner:
      IMG_BASE +
      "One Piece Episode of Chopper Plus Bloom in the Winter, Miracle Cherry Blossom.jpg",
    desc: "One Piece: Episode of Chopper Plus: Bloom in the Winter, Miracle Cherry Blossom",
    group: "One Piece",
    partName: "Movie 9",
  },
  {
    title: "One Piece: Strong World",
    slug: "dao-hai-tac-10-the-gioi-suc-manh",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Strong World.jpg",
    banner: IMG_BASE + "One Piece Strong World.jpg",
    desc: "One Piece: Strong World",
    group: "One Piece",
    partName: "Movie 10",
  },
  {
    title: "One Piece 3D: Straw Hat Chase",
    slug: "dao-hai-tac-11-truy-tim-mu-rom",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece 3D Straw Hat Chase.jpg",
    banner: IMG_BASE + "One Piece 3D Straw Hat Chase.jpg",
    desc: "One Piece 3D: Straw Hat Chase",
    group: "One Piece",
    partName: "Movie 11",
  },
  {
    title: "One Piece Film: Z",
    slug: "dao-hai-tac-12-z-ky-phung-dich-thu",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Film Z.jpg",
    banner: IMG_BASE + "One Piece Film Z.jpg",
    desc: "One Piece Film: Z",
    group: "One Piece",
    partName: "Movie 12",
  },
  {
    title: "One Piece: Episode Of Sabo",
    slug: "vua-hai-tac-chuong-sabo-moi-lien-ket-cua-ba-anh-em-va-y-chi-duoc-ke-thua",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Episode Of Sabo.jpg",
    banner: IMG_BASE + "One Piece Episode Of Sabo.jpg",
    desc: "One Piece: Episode Of Sabo",
    group: "One Piece",
    partName: "TV Special (Sabo)",
  },
  {
    title: "One Piece: Adventure Of Nebulandia",
    slug: "vua-hai-tac-cuoc-phieu-luu-den-nebulandia",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Adventure Of Nebulandia.jpg",
    banner: IMG_BASE + "One Piece Adventure Of Nebulandia.jpg",
    desc: "One Piece: Adventure Of Nebulandia",
    group: "One Piece",
    partName: "TV Special",
  },
  {
    title: "One Piece Film: GOLD",
    slug: "dao-hai-tac-13-gold",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Film GOLD.jpg",
    banner: IMG_BASE + "One Piece Film GOLD.jpg",
    desc: "One Piece Film: GOLD",
    group: "One Piece",
    partName: "Movie 13",
  },
  {
    title: "One Piece: Heart of Gold",
    slug: "dao-hai-tac-trai-tim-vang",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Heart of Gold.jpg",
    banner: IMG_BASE + "One Piece Heart of Gold.jpg",
    desc: "One Piece: Clockwork Island Adventure",
    group: "One Piece",
    partName: "TV Special (Movie 13.5)",
  },
  {
    title: "One Piece: Episode of Skypiea",
    slug: "dao-hai-tac-chuong-skypiea",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Episode of Skypiea.jpg",
    banner: IMG_BASE + "One Piece Episode of Skypiea.jpg",
    desc: "One Piece: Episode of Skypiea",
    group: "One Piece",
    partName: "TV Special (Tóm tắt Arc Skypiea)",
  },
  {
    title: "One Piece: Stampede",
    slug: "dao-hai-tac-14-le-hoi-hai-tac",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Stampede.jpg",
    banner: IMG_BASE + "One Piece Stampede.jpg",
    desc: "One Piece: Stampede",
    group: "One Piece",
    partName: "Movie 14",
  },
  {
    title: "ONE PIECE FILM RED",
    slug: "one-piece-film-red",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "ONE PIECE FILM RED.jpg",
    banner: IMG_BASE + "ONE PIECE FILM RED.jpg",
    desc: "ONE PIECE FILM RED",
    group: "One Piece",
    partName: "Movie 15",
  },
  {
    title: "ONE PIECE (Live Action) (Season 1)",
    slug: "dao-hai-tac-live-action-phan-1",
    episodes: 8,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "ONE PIECE (Live Action) (Season 1).jpg",
    banner: IMG_BASE + "ONE PIECE (Live Action) (Season 1).jpg",
    desc: "ONE PIECE (Live Action) (Season 1)",
    group: "One Piece",
    partName: "Live Action 1",
  },
  {
    title: "One Piece Fan Letter",
    slug: "thu-cua-fan-onepiece",
    episodes: 1,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Fan Letter.jpg",
    banner: IMG_BASE + "One Piece Fan Letter.jpg",
    desc: "One Piece Fan Letter",
    group: "One Piece",
    partName: "Special 25 Years",
  },
  {
    title: "One Piece Log: Fish-Man Island Saga",
    slug: "nhat-ky-hai-trinh-one-piece-truyen-ky-dao-nguoi-ca",
    episodes: 21,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Log Fish-Man Island Saga.jpg",
    banner: IMG_BASE + "One Piece Log Fish-Man Island Saga.jpg",
    desc: "One Piece Log: Fish-Man Island Saga",
    group: "One Piece",
    partName: "Remaster Arc Đảo Người Cá",
  },
  {
    title: "ONE PIECE (Live Action) (Season 2)",
    slug: "dao-hai-tac-live-action-phan-2",
    episodes: 8,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "ONE PIECE (Live Action) (Season 2).jpg",
    banner: IMG_BASE + "ONE PIECE (Live Action) (Season 2).jpg",
    desc: "ONE PIECE (Live Action) (Season 2)",
    group: "One Piece",
    partName: "Live Action 2",
  },
  {
    title: "One Piece: Heroines",
    slug: "one-piece-nu-hung",
    episodes: 8,
    genres: "Hài Hước, Hành Động, Phiêu Lưu, Anime",
    poster: IMG_BASE + "One Piece Heroines.jpg",
    banner: IMG_BASE + "One Piece Heroines.jpg",
    desc: "One Piece: Heroines",
    group: "One Piece",
    partName: "One Piece: Heroines",
  },
  {
    title: "Our Sticky Love",
    slug: "keo-ngot-tinh-yeu",
    episodes: 12,
    genres: "Chính Kịch, Hài Hước, Tâm Lý, Tình Cảm, Hàn Quốc",
    poster: IMG_BASE + "Our Sticky Love.jpg",
    banner: IMG_BASE + "Our Sticky Love.jpg",
    desc: "Our Sticky Love",
  },
  {
    title: "My Bias, My Boss",
    slug: "sep-chinh-la-than-tuong-bias-toi-sep-cua-toi",
    episodes: 12,
    genres: "Chính Kịch, Hài Hước, Hàn Quốc",
    poster: IMG_BASE + "My Bias, My Boss.jpg",
    banner: IMG_BASE + "My Bias, My Boss.jpg",
    desc: "My Bias, My Boss",
  },
  {
    title: "Dream To You",
    slug: "giac-mo-trao-em",
    episodes: 12,
    genres: "Chính Kịch, Hài Hước, Tâm Lý, Tình Cảm, Hàn Quốc",
    poster: IMG_BASE + "Dream To You.jpg",
    banner: IMG_BASE + "Dream To You.jpg",
    desc: "Dream To You",
  },
  {
    title: "Love Next Door",
    slug: "con-trai-ban-me",
    episodes: 16,
    genres: "Chính Kịch, Hài Hước, Tâm Lý, Tình Cảm, Hàn Quốc",
    poster: IMG_BASE + "Love Next Door.jpg",
    banner: IMG_BASE + "Love Next Door.jpg",
    desc: "Love Next Door",
  },
  {
    title: "Bloody Flower",
    slug: "hoa-mau",
    episodes: 8,
    genres: "Hình Sự, Chính Kịch, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Bloody Flower.jpg",
    banner: IMG_BASE + "Bloody Flower.jpg",
    desc: "Bloody Flower",
  },
  {
    title: "A Shop for Killers (Season 1)",
    slug: "cua-hang-sat-thu-phan-1",
    episodes: 8,
    genres: "Bí Ẩn, Chính Kịch, Hành Động, Hình Sự, Phiêu Lưu, Hàn Quốc",
    poster: IMG_BASE + "A Shop for Killers (Season 1).jpg",
    banner: IMG_BASE + "A Shop for Killers (Season 1).jpg",
    desc: "A Shop for Killers (Season 1)",
    group: "A Shop for Killers",
    partName: "A Shop for Killers 1",
  },
  {
    title: "A Shop for Killers (Season 2)",
    slug: "cua-hang-sat-thu-phan-2",
    episodes: 8,
    genres: "Bí Ẩn, Chính Kịch, Hành Động, Hình Sự, Phiêu Lưu, Hàn Quốc",
    poster: IMG_BASE + "A Shop for Killers (Season 2).jpg",
    banner: IMG_BASE + "A Shop for Killers (Season 2).jpg",
    desc: "A Shop for Killers (Season 2)",
    group: "A Shop for Killers",
    partName: "A Shop for Killers 2",
  },
  {
    title: "Detective Conan: The Time Bombed Skyscraper",
    slug: "tham-tu-lung-danh-conan-qua-bom-choc-troi",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Time Bombed Skyscraper.jpg",
    banner: IMG_BASE + "Detective Conan The Time Bombed Skyscraper.jpg",
    desc: "Detective Conan: The Time Bombed Skyscraper",
    group: "Conan",
    partName: "Movie 1",
  },
  {
    title: "Detective Conan: The Fourteenth Target",
    slug: "tham-tu-lung-danh-conan-2-muc-tieu-thu-14",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Fourteenth Target.jpg",
    banner: IMG_BASE + "Detective Conan The Fourteenth Target.jpg",
    desc: "Detective Conan: The Fourteenth Target",
    group: "Conan",
    partName: "Movie 2",
  },
  {
    title: "Detective Conan: The Last Wizard of the Century",
    slug: "tham-tu-lung-danh-conan-3-ao-thuat-gia-cuoi-cung-cua-the-ky",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Last Wizard of the Century.jpg",
    banner: IMG_BASE + "Detective Conan The Last Wizard of the Century.jpg",
    desc: "Detective Conan: The Last Wizard of the Century",
    group: "Conan",
    partName: "Movie 3",
  },
  {
    title: "Detective Conan: Captured in Her Eyes",
    slug: "tham-tu-lung-danh-conan-4-thu-pham-trong-doi-mat",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Captured in Her Eyes.jpg",
    banner: IMG_BASE + "Detective Conan Captured in Her Eyes.jpg",
    desc: "Detective Conan: Captured in Her Eyes",
    group: "Conan",
    partName: "Movie 4",
  },
  {
    title: "Case Closed: Countdown to Heaven",
    slug: "tham-tu-lung-danh-conan-5-nhung-giay-cuoi-cung-toi-thien-duong",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Case Closed Countdown to Heaven.jpg",
    banner: IMG_BASE + "Case Closed Countdown to Heaven.jpg",
    desc: "Case Closed: Countdown to Heaven",
    group: "Conan",
    partName: "Movie 5",
  },
  {
    title: "Detective Conan: The Phantom of Baker Street",
    slug: "tham-tu-lung-danh-conan-bong-ma-duong-baker",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Phantom of Baker Street.jpg",
    banner: IMG_BASE + "Detective Conan The Phantom of Baker Street.jpg",
    desc: "Detective Conan: The Phantom of Baker Street",
    group: "Conan",
    partName: "Movie 6",
  },
  {
    title: "Detective Conan: Crossroad in the Ancient Capital",
    slug: "tham-tu-lung-danh-conan-7-me-cung-trong-thanh-pho-co",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Crossroad in the Ancient Capital.jpg",
    banner: IMG_BASE + "Detective Conan Crossroad in the Ancient Capital.jpg",
    desc: "Detective Conan: Crossroad in the Ancient Capital",
    group: "Conan",
    partName: "Movie 7",
  },
  {
    title: "Detective Conan: Magician of the Silver Sky",
    slug: "tham-tu-lung-danh-conan-8-nha-ao-thuat-voi-doi-canh-bac",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Magician of the Silver Sky.jpg",
    banner: IMG_BASE + "Detective Conan Magician of the Silver Sky.jpg",
    desc: "Detective Conan: Magician of the Silver Sky",
    group: "Conan",
    partName: "Movie 8",
  },
  {
    title: "Detective Conan: Strategy Above the Depths",
    slug: "tham-tu-lung-danh-conan-9-am-muu-tren-bien",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Strategy Above the Depths.jpg",
    banner: IMG_BASE + "Detective Conan Strategy Above the Depths.jpg",
    desc: "Detective Conan: Strategy Above the Depths",
    group: "Conan",
    partName: "Movie 9",
  },
  {
    title: "Detective Conan: The Private Eyes' Requiem",
    slug: "tham-tu-lung-danh-conan-10-le-cau-hon-cua-tham-tu",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Private Eyes' Requiem.jpg",
    banner: IMG_BASE + "Detective Conan The Private Eyes' Requiem.jpg",
    desc: "Detective Conan: The Private Eyes' Requiem",
    group: "Conan",
    partName: "Movie 10",
  },
  {
    title: "Detective Conan: Jolly Roger in the Deep Azure",
    slug: "tham-tu-lung-danh-conan-11-kho-bau-duoi-day-dai-duong",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Jolly Roger in the Deep Azure.jpg",
    banner: IMG_BASE + "Detective Conan Jolly Roger in the Deep Azure.jpg",
    desc: "Detective Conan: Jolly Roger in the Deep Azure",
    group: "Conan",
    partName: "Movie 11",
  },
  {
    title: "Detective Conan: Full Score of Fear",
    slug: "tham-tu-lung-danh-conan-12-tan-cung-cua-su-so-hai",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Full Score of Fear.jpg",
    banner: IMG_BASE + "Detective Conan Full Score of Fear.jpg",
    desc: "Detective Conan: Full Score of Fear",
    group: "Conan",
    partName: "Movie 12",
  },
  {
    title: "Lupin III vs. Detective Conan",
    slug: "lupin-de-tam-tham-tu-conan",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Lupin III vs. Detective Conan.jpg",
    banner: IMG_BASE + "Lupin III vs. Detective Conan.jpg",
    desc: "Lupin III vs. Detective Conan",
    group: "Conan",
    partName: "Lupin III vs. Detective Conan",
  },
  {
    title: "Detective Conan: The Raven Chaser",
    slug: "tham-tu-lung-danh-conan-13-truy-lung-to-chuc-ao-den",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Raven Chaser.jpg",
    banner: IMG_BASE + "Detective Conan The Raven Chaser.jpg",
    desc: "Detective Conan: The Raven Chaser",
    group: "Conan",
    partName: "Movie 13",
  },
  {
    title: "Detective Conan: The Lost Ship in the Sky",
    slug: "tham-tu-lung-danh-conan-14-con-tau-bien-mat-giua-troi-xanh",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Lost Ship in the Sky.jpg",
    banner: IMG_BASE + "Detective Conan The Lost Ship in the Sky.jpg",
    desc: "Detective Conan: The Lost Ship in the Sky",
    group: "Conan",
    partName: "Movie 14",
  },
  {
    title: "Detective Conan: Quarter Of Silence",
    slug: "tham-tu-lung-danh-conan-15-15-phut-tinh-lang",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Quarter Of Silence.jpg",
    banner: IMG_BASE + "Detective Conan Quarter Of Silence.jpg",
    desc: "Detective Conan: Quarter Of Silence",
    group: "Conan",
    partName: "Movie 15",
  },
  {
    title: "Detective Conan: The Eleventh Striker",
    slug: "tham-tu-lung-danh-conan-16-tien-dao-thu-11",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Eleventh Striker.jpg",
    banner: IMG_BASE + "Detective Conan The Eleventh Striker.jpg",
    desc: "Detective Conan: The Eleventh Striker",
    group: "Conan",
    partName: "Movie 16",
  },
  {
    title: "Lupin III vs. Detective Conan: The Movie",
    slug: "lupin-de-tam-va-tham-tu-lung-danh-conan",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Lupin III vs. Detective Conan The Movie.jpg",
    banner: IMG_BASE + "Lupin III vs. Detective Conan The Movie.jpg",
    desc: "Lupin III vs. Detective Conan: The Movie",
    group: "Conan",
    partName: "Lupin III vs. Detective Conan: The Movie",
  },
  {
    title: "Detective Conan: Private Eye in the Distant Sea",
    slug: "tham-tu-lung-danh-conan-17-con-mat-bi-an-ngoai-bien-xa",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Private Eye in the Distant Sea.jpg",
    banner: IMG_BASE + "Detective Conan Private Eye in the Distant Sea.jpg",
    desc: "Detective Conan: Private Eye in the Distant Sea",
    group: "Conan",
    partName: "Movie 17",
  },
  {
    title: "Detective Conan: Dimensional Sniper",
    slug: "tham-tu-lung-danh-conan-sat-thu-ban-tia-khong-tuong",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Dimensional Sniper.jpg",
    banner: IMG_BASE + "Detective Conan Dimensional Sniper.jpg",
    desc: "Detective Conan: Dimensional Sniper",
    group: "Conan",
    partName: "Movie 18",
  },
  {
    title: "Detective Conan: Sunflowers of Inferno",
    slug: "tham-tu-lung-danh-conan-19-hoa-huong-duong-ruc-lua",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Sunflowers of Inferno.jpg",
    banner: IMG_BASE + "Detective Conan Sunflowers of Inferno.jpg",
    desc: "Detective Conan: Sunflowers of Inferno",
    group: "Conan",
    partName: "Movie 19",
  },
  {
    title: "Detective Conan: The Darkest Nightmare",
    slug: "tham-tu-lung-danh-conan-20-con-ac-mong-den-toi",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Darkest Nightmare.jpg",
    banner: IMG_BASE + "Detective Conan The Darkest Nightmare.jpg",
    desc: "Detective Conan: The Darkest Nightmare",
    group: "Conan",
    partName: "Movie 20",
  },
  {
    title: "Case Closed: The Crimson Love Letter",
    slug: "tham-tu-lung-danh-conan-21-ban-tinh-ca-mau-do-tham",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Case Closed The Crimson Love Letter.jpg",
    banner: IMG_BASE + "Case Closed The Crimson Love Letter.jpg",
    desc: "Case Closed: The Crimson Love Letter",
    group: "Conan",
    partName: "Movie 21",
  },
  {
    title: "Case Closed: Zero the Enforcer",
    slug: "tham-tu-lung-danh-conan-22-ke-hanh-phap-zero",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Case Closed Zero the Enforcer.jpg",
    banner: IMG_BASE + "Case Closed Zero the Enforcer.jpg",
    desc: "Case Closed: Zero the Enforcer",
    group: "Conan",
    partName: "Movie 22",
  },
  {
    title: "Case Closed: The Fist of Blue Sapphire",
    slug: "tham-tu-lung-danh-conan-23-cu-dam-sapphire-xanh",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Case Closed The Fist of Blue Sapphire.jpg",
    banner: IMG_BASE + "Case Closed The Fist of Blue Sapphire.jpg",
    desc: "Case Closed: The Fist of Blue Sapphire",
    group: "Conan",
    partName: "Movie 23",
  },
  {
    title: "Detective Conan: The Scarlet Bullet",
    slug: "tham-tu-lung-danh-conan-24-vien-dan-do",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Scarlet Bullet.jpg",
    banner: IMG_BASE + "Detective Conan The Scarlet Bullet.jpg",
    desc: "Detective Conan: The Scarlet Bullet",
    group: "Conan",
    partName: "Movie 24",
  },
  {
    title: "Detective Conan: The Bride of Halloween",
    slug: "tham-tu-lung-danh-conan-25-nang-dau-halloween",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Bride of Halloween.jpg",
    banner: IMG_BASE + "Detective Conan The Bride of Halloween.jpg",
    desc: "Detective Conan: The Bride of Halloween",
    group: "Conan",
    partName: "Movie 25",
  },
  {
    title: "Detective Conan: Zero's Tea Time",
    slug: "tham-tu-lung-danh-conan-gio-tra-cua-zero",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Zero's Tea Time.jpg",
    banner: IMG_BASE + "Detective Conan Zero's Tea Time.jpg",
    desc: "Detective Conan: Zero's Tea Time",
    group: "Conan",
    partName: "Detective Conan: Zero's Tea Time",
  },
  {
    title: "Detective Conan: The Culprit Hanzawa",
    slug: "tham-tu-lung-danh-conan-hanzawa-chang-hung-thu-so-nho",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Culprit Hanzawa.jpg",
    banner: IMG_BASE + "Detective Conan The Culprit Hanzawa.jpg",
    desc: "Detective Conan: The Culprit Hanzawa",
    group: "Conan",
    partName: "Ova",
  },
  {
    title: "Detective Conan: Black Iron Submarine",
    slug: "tham-tu-lung-danh-conan-26-tau-ngam-sat-mau-den",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan Black Iron Submarine.jpg",
    banner: IMG_BASE + "Detective Conan Black Iron Submarine.jpg",
    desc: "Detective Conan: Black Iron Submarine",
    group: "Conan",
    partName: "Movie 26",
  },
  {
    title: "Detective Conan Movie 27: The Million Dollar Pentagram",
    slug: "tham-tu-lung-danh-conan-ngoi-sao-5-canh-1-trieu-do",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster:
      IMG_BASE + "Detective Conan Movie 27 The Million Dollar Pentagram.jpg",
    banner:
      IMG_BASE + "Detective Conan Movie 27 The Million Dollar Pentagram.jpg",
    desc: "Detective Conan Movie 27: The Million Dollar Pentagram",
    group: "Conan",
    partName: "Movie 27",
  },
  {
    title: "Detective Conan: One-Eyed Flashback",
    slug: "tham-tu-lung-danh-conan-28-du-anh-cua-doc-nhan",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan One-Eyed Flashback.jpg",
    banner: IMG_BASE + "Detective Conan One-Eyed Flashback.jpg",
    desc: "Detective Conan: One-Eyed Flashback",
    group: "Conan",
    partName: "Movie 28",
  },
  {
    title: "Detective Conan: The Counterfeit Case of Ultra 30",
    slug: "tham-tu-lung-danh-conan-vu-an-tien-gia-ultra-30",
    episodes: 1,
    genres: "Hoạt Hình, Hành Động, Bí Ẩn, Hình Sự, Anime",
    poster: IMG_BASE + "Detective Conan The Counterfeit Case of Ultra 30.jpg",
    banner: IMG_BASE + "Detective Conan The Counterfeit Case of Ultra 30.jpg",
    desc: "Detective Conan: The Counterfeit Case of Ultra 30",
    group: "Conan",
    partName: "Detective Conan: The Counterfeit Case of Ultra 30",
  },
  {
    title: "Train to Busan",
    slug: "chuyen-tau-sinh-tu",
    episodes: 1,
    genres: "Hành Động, Phiêu Lưu, Kinh Dị, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Train to Busan.jpg",
    banner: IMG_BASE + "Train to Busan.jpg",
    desc: "Train to Busan",
    group: "Train to Busan",
    partName: "Phần 1",
  },
  {
    title: "Train to Busan 2",
    slug: "train-to-busan-2-ban-dao-peninsula",
    episodes: 1,
    genres: "Hành Động, Phiêu Lưu, Kinh Dị, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Train to Busan 2.jpg",
    banner: IMG_BASE + "Train to Busan 2.jpg",
    desc: "Train to Busan 2",
    group: "Train to Busan",
    partName: "Phần 2",
  },
  {
    title: "Parasite",
    slug: "ky-sinh-trung",
    episodes: 1,
    genres: "Hài Hước, Chính Kịch, Tâm Lý, Hàn Quốc",
    poster: IMG_BASE + "Parasite.jpg",
    banner: IMG_BASE + "Parasite.jpg",
    desc: "Parasite",
  },
];
// ==========================================
// 0C. GỌI API PHIM TỪ BACKEND (thay cho data hardcode)
// ==========================================

// Chuẩn hóa 1 dòng dữ liệu trả về từ MySQL API thành đúng cấu trúc
// mà toàn bộ code render/wishlist/continue-watching bên dưới đang dùng
function normalizeMovie(row) {
  return {
    title: row.title,
    slug: row.slug,
    poster: row.poster,
    banner: row.banner || row.poster,
    desc: row.description,
    genres: row.genres,
    episodes: row.total_episodes,
    group: row.movie_group,
    partName: row.part_name,
  };
}

// Xác định nguồn dữ liệu sẽ dùng: "auto" (mặc định, SQL trước - lỗi thì
// rớt về hardcode), "hardcode" (ép dùng hardcode, bỏ qua API - test UI
// nhanh không cần chạy backend), "sql" (ép chỉ dùng MySQL, KHÔNG tự rớt
// về hardcode kể cả khi lỗi/rỗng - để thấy đúng lỗi thật khi test SQL).
// Nếu không truyền source trong code, tự đọc từ URL: ?data_source=hardcode
// hoặc ?data_source=sql, tiện để ép nguồn ngay trên trình duyệt khi test.
function resolveDataSource(explicitSource) {
  if (explicitSource === "hardcode" || explicitSource === "sql") {
    return explicitSource;
  }
  try {
    const urlSource = new URLSearchParams(window.location.search).get(
      "data_source",
    );
    if (urlSource === "hardcode" || urlSource === "sql") return urlSource;
  } catch (e) {
    // window.location không khả dụng (vd chạy ngoài trình duyệt) -> bỏ qua
  }
  return "auto";
}

// Lấy danh sách phim có phân trang, có thể lọc theo thể loại
async function fetchMovies({
  page = 1,
  limit = 20,
  genre = null,
  group = null,
  source = "auto",
} = {}) {
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return filterFallbackMovies({ genre, group });
  }

  try {
    const params = new URLSearchParams({ page, limit });
    if (genre) params.set("genre", genre);
    if (group) params.set("group", group);
    const res = await fetch(`${API_BASE_URL}/api/movies?${params.toString()}`);
    if (!res.ok) throw new Error(`API /api/movies lỗi ${res.status}`);
    const data = await res.json();
    const movies = (data.movies || []).map(normalizeMovie);

    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: trả nguyên kết quả thật (có thể rỗng), không che
      // bằng hardcode để test thấy đúng dữ liệu/trạng thái thật từ DB.
      return movies;
    }
    return movies.length ? movies : filterFallbackMovies({ genre, group });
  } catch (err) {
    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: không rớt về hardcode, ném lỗi ra để thấy rõ
      // lỗi thật khi test (API sập, sai cổng, mất mạng...).
      console.error("Lỗi tải danh sách phim từ API (source=sql):", err);
      throw err;
    }
    console.error("Lỗi tải danh sách phim từ API, dùng dữ liệu dự phòng:", err);
    return filterFallbackMovies({ genre, group });
  }
}

// Lọc mảng hardcode dự phòng theo genre/group, dùng khi API MySQL không
// gọi được (mất mạng, backend chưa chạy...)
function filterFallbackMovies({ genre = null, group = null } = {}) {
  let list = fallbackMoviesList;
  if (genre) {
    list = list.filter((m) =>
      (m.genres || "").toLowerCase().includes(genre.toLowerCase()),
    );
  }
  if (group) {
    list = list.filter((m) => m.group === group);
  }
  return list;
}

// Lấy chi tiết 1 phim theo slug (kèm episodes = mảng link m3u8 thật từ MySQL)
function findFallbackMovieBySlug(slug) {
  const fb = fallbackMoviesList.find((m) => m.slug === slug);
  if (!fb) return null;
  const movie = { ...fb };
  movie.episodeUrls =
    (window.allEpisodesData && window.allEpisodesData[slug]) || [];
  return movie;
}

async function fetchMovieBySlug(slug, { source = "auto" } = {}) {
  if (!slug) return null;
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return findFallbackMovieBySlug(slug);
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/movies/${encodeURIComponent(slug)}`,
    );
    if (!res.ok) throw new Error(`API /api/movies/${slug} lỗi ${res.status}`);
    const row = await res.json();
    const movie = normalizeMovie(row);
    movie.episodeUrls = row.episodes || []; // link m3u8 thật, tách riêng khỏi "episodes" (số tập)
    return movie;
  } catch (err) {
    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: không rớt về hardcode, để lộ đúng lỗi thật khi test.
      console.error(`Lỗi tải chi tiết phim từ API (source=sql):`, err);
      throw err;
    }
    console.error(
      "Lỗi tải chi tiết phim từ API, thử dùng dữ liệu dự phòng:",
      err,
    );
    // Fallback: tìm trong mảng hardcode + Episodes.js (nếu có) để trang
    // watch/detail vẫn hiển thị được thay vì trắng trang khi API/DB die
    return findFallbackMovieBySlug(slug);
  }
}

// Tìm trong mảng hardcode theo tên hoặc thể loại (dùng khi ép source=hardcode
// hoặc khi API search lỗi và không ở chế độ ép SQL)
function searchFallbackMovies(query, limit = 40) {
  const q = (query || "").toLowerCase();
  return fallbackMoviesList
    .filter(
      (m) =>
        (m.title || "").toLowerCase().includes(q) ||
        (m.genres || "").toLowerCase().includes(q),
    )
    .slice(0, limit);
}

// Tìm kiếm phim theo tên/thể loại qua API
async function searchMoviesAPI(query, limit = 40, { source = "auto" } = {}) {
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return searchFallbackMovies(query, limit);
  }

  try {
    const params = new URLSearchParams({ q: query, limit });
    const res = await fetch(
      `${API_BASE_URL}/api/movies/search?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`API /api/movies/search lỗi ${res.status}`);
    const data = await res.json();
    return (data.movies || []).map(normalizeMovie);
  } catch (err) {
    if (dataSource === "sql") {
      console.error("Lỗi tìm kiếm phim từ API (source=sql):", err);
      throw err;
    }
    console.error("Lỗi tìm kiếm phim từ API, dùng dữ liệu dự phòng:", err);
    return searchFallbackMovies(query, limit);
  }
}

// Danh sách phim dùng chung toàn trang. Khởi tạo sẵn bằng fallbackMoviesList
// để có gì đó hiển thị ngay (không phải chờ API), sau đó được merge thêm
// phim thật từ MySQL qua các lần fetch API bên dưới (addToGlobalMoviesList).
// detail.html / watch.html đọc qua window.globalMoviesList giống như trước.
let globalMoviesList = [...fallbackMoviesList];
window.globalMoviesList = globalMoviesList;

// Gộp thêm phim mới fetch được vào danh sách chung, tự loại trùng theo slug
function addToGlobalMoviesList(movies) {
  (movies || []).forEach((m) => {
    if (!globalMoviesList.some((existing) => existing.slug === m.slug)) {
      globalMoviesList.push(m);
    }
  });
}

// ==========================================
// 0B. ĐIỀU HƯỚNG TRANG (ROUTER) - switchPage()
// ==========================================
// Hàm này được gọi từ các onclick trong index.html (Trang chủ, Danh sách
// của tôi, Chi tiết, Xem phim...). Trước đây bị thiếu nên bấm không có
// phản ứng gì.
function switchPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add("active");
  } else {
    console.warn(`switchPage: không tìm thấy #page-${pageName}`);
  }

  if (pageName === "wishlist" && typeof renderWishlistPage === "function") {
    renderWishlistPage();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeForInlineHandler(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ");
}

// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH, WATCHLIST & FAVORITE
// ==========================================

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("token", data.token);
      alert("Đăng nhập thành công!");
    } else {
      alert(data.message || "Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
  }
}

function getWishlist() {
  const wishlist = localStorage.getItem("my_wishlist");
  return wishlist ? JSON.parse(wishlist) : [];
}

function toggleWishlist(movie) {
  let wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.title === movie.title);

  if (index !== -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(movie);
  }

  localStorage.setItem("my_wishlist", JSON.stringify(wishlist));
  updateWishlistUI();

  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }

  toggleFavoriteBackend(movie.title);
}

async function toggleFavoriteBackend(movieId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/api/watchlist/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ movieId }),
    });
  } catch (err) {
    console.error("Lỗi đồng bộ wishlist backend:", err);
  }
}

function updateWishlistUI() {
  const wishlist = getWishlist();
  const heartBtns = document.querySelectorAll(".movie-card .btn-hover.icon");

  heartBtns.forEach((btn) => {
    const card = btn.closest(".movie-card");
    if (!card) return;
    const titleEl =
      card.querySelector(".hover-title") ||
      card.querySelector("h3") ||
      card.querySelector("h4");
    if (!titleEl) return;

    const title = titleEl.innerText.trim();
    const isFav = wishlist.some((item) => item.title === title);

    const icon = btn.querySelector("i");
    if (icon) {
      if (isFav) {
        icon.className = "fa-solid fa-heart";
        icon.style.color = "#e50914";
      } else {
        icon.className = "fa-regular fa-heart";
        icon.style.color = "";
      }
    }
  });
}

function renderWishlistPage() {
  const container = document.getElementById("wishlist-container");
  if (!container) return;

  const wishlist = getWishlist();
  container.innerHTML = "";

  if (wishlist.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-regular fa-heart" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Danh sách của bạn đang trống. Hãy thêm những bộ phim yêu thích vào đây nhé!</p>
      </div>
    `;
    return;
  }

  wishlist.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug || "",
      );

    const safeTitle = escapeHtml(movie.title);
    const safeDesc = escapeHtml(movie.desc || "");
    const handlerTitle = escapeForInlineHandler(movie.title);
    const handlerDesc = escapeForInlineHandler(movie.desc || "");

    card.innerHTML = `
      <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${movie.slug || ""}')">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Xóa khỏi danh sách"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-solid fa-heart" style="color: #e50914;"></i>
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// 2. HERO BANNER - 4 PHIM NỔI BẬT AUTO-SLIDE, ĐỔI BỘ 4 PHIM MỖI NGÀY
// ==========================================

let currentHeroIndex = 0;
let heroInterval = null;

// Chọn ra 4 phim "nổi bật" cho hôm nay: dựa theo số ngày kể từ epoch để
// dịch chuyển vị trí bắt đầu trong toàn bộ danh sách phim (có vòng lặp),
// nên mỗi ngày sẽ ra 1 bộ 4 phim khác nhau, sang ngày mới lại đổi bộ khác.
function getDailyFeaturedList(movies, count = 4) {
  if (!movies || movies.length === 0) return [];
  const total = movies.length;
  const daysSinceEpoch = Math.floor(Date.now() / 86400000); // 1 đơn vị = 1 ngày
  const startIndex = daysSinceEpoch % total;

  const result = [];
  const limit = Math.min(count, total);
  for (let i = 0; i < limit; i++) {
    result.push(movies[(startIndex + i) % total]);
  }
  return result;
}

function updateHeroBanner(index, featuredList) {
  const list = featuredList || window.currentHeroFeatured;
  if (!list || list.length === 0) return;

  const movie = list[index % list.length];
  const heroSection = document.getElementById("hero-banner");
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const playBtn = document.getElementById("hero-play-btn");
  const infoBtn = document.getElementById("hero-info-btn");

  if (!heroSection) return;

  heroSection.style.backgroundImage = `url('${movie.banner || movie.poster}')`;
  if (titleEl) titleEl.innerText = movie.title;
  if (descEl) descEl.innerText = movie.desc;

  if (playBtn) {
    playBtn.onclick = () =>
      playEpisodeDirect(movie.title, 1, getTotalEpisodes(movie), movie.slug);
  }
  if (infoBtn) {
    infoBtn.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );
  }

  const dots = document.querySelectorAll(".hero-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

function initHeroSlider(preloadedMovies) {
  const heroSection = document.getElementById("hero-banner");
  const pool =
    preloadedMovies && preloadedMovies.length
      ? preloadedMovies
      : globalMoviesList;
  if (!heroSection || !pool || pool.length === 0) return;

  let dotsContainer = heroSection.querySelector(".hero-dots");
  if (!dotsContainer) {
    dotsContainer = document.createElement("div");
    dotsContainer.className = "hero-dots";
    heroSection.appendChild(dotsContainer);
  } else {
    dotsContainer.innerHTML = "";
  }

  // Bộ 4 phim nổi bật của riêng hôm nay (lưu lại để dùng xuyên suốt trang)
  const featured = getDailyFeaturedList(pool, 4);
  window.currentHeroFeatured = featured;

  featured.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = `hero-dot ${index === 0 ? "active" : ""}`;
    dot.onclick = () => {
      currentHeroIndex = index;
      updateHeroBanner(currentHeroIndex, featured);
      resetHeroTimer();
    };
    dotsContainer.appendChild(dot);
  });

  currentHeroIndex = 0;
  updateHeroBanner(0, featured);
  startHeroTimer();
}

function startHeroTimer() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    const featured = window.currentHeroFeatured || [];
    const limit = featured.length;
    if (limit === 0) return;
    currentHeroIndex = (currentHeroIndex + 1) % limit;
    updateHeroBanner(currentHeroIndex, featured);
  }, 5000);
}

function resetHeroTimer() {
  clearInterval(heroInterval);
  startHeroTimer();
}

// ==========================================
// 3. QUẢN LÝ VÀ RENDER "TIẾP TỤC XEM"
// ==========================================

function getContinueWatchingList() {
  const raw = localStorage.getItem("continue_watching_list");
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch (e) {
    list = [];
  }
  if (!Array.isArray(list)) return [];

  // Mỗi phim chỉ giữ 1 bản ghi mới nhất (dọn dữ liệu cũ bị lưu theo từng tập)
  const seen = new Set();
  const cleaned = list
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter((item) => {
      const key = item.slug || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (cleaned.length !== list.length) {
    localStorage.setItem("continue_watching_list", JSON.stringify(cleaned));
  }
  return cleaned;
}

function renderContinueWatching() {
  const section = document.getElementById("continue-watching-section");
  const slider = document.getElementById("continue-watching-slider");
  if (!section || !slider) return;

  const list = getContinueWatchingList();

  if (list.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  slider.innerHTML = "";

  list.forEach((item) => {
    const movieMeta =
      globalMoviesList.find((m) => m.title === item.title) || {};
    const posterSrc =
      item.poster || movieMeta.poster || "https://placehold.co/350x500";
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.desc || movieMeta.desc || "");

    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.position = "relative";
    card.onclick = () =>
      playEpisodeDirect(
        item.title,
        item.episode,
        item.totalEpisodes,
        item.slug,
      );

    card.innerHTML = `
      <img src="${posterSrc}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle} - Tập ${item.episode}</h4>
     
      <div style="width: 100%; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 5px; overflow: hidden;">
        <div style="width: ${item.progress}%; background: #e50914; height: 100%;"></div>
      </div>

      <div class="movie-hover-card">
        <img src="${posterSrc}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <p style="color: #e50914; font-weight: bold; margin-bottom: 5px;">Đang xem: Tập ${item.episode}</p>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem tiếp (${Math.floor(item.progress)}%)
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    slider.appendChild(card);
  });
}

// ==========================================
// 4. RENDER PHIM TRANG CHỦ & ĐIỀU HƯỚNG TRANG
// ==========================================

function showDetail(
  title,
  posterSrc,
  description,
  totalEpisodes = 20,
  slug = "",
) {
  const params = new URLSearchParams({
    title: title || "",
    slug: slug || "",
    poster: posterSrc || "",
    desc: description || "",
    episodes: totalEpisodes || 20,
  });

  window.location.href = `detail.html?${params.toString()}`;
}

function playEpisodeDirect(
  movieTitle,
  episodeNum = 1,
  totalEpisodes = 20,
  slug = "",
) {
  const movieObj =
    globalMoviesList.find(
      (m) => m.title.toLowerCase() === movieTitle.toLowerCase(),
    ) || {};
  const movieSlug = slug || movieObj.slug || "";

  const params = new URLSearchParams({
    title: movieTitle,
    ep: episodeNum,
    slug: movieSlug,
    episodes: totalEpisodes || movieObj.episodes || 20,
  });

  window.location.href = `watch.html?${params.toString()}`;
}

// Dựng 1 thẻ phim (card) dùng chung cho tất cả các slider/search/genre-filter
function createMovieCard(movie) {
  const card = document.createElement("div");
  card.className = "movie-card";
  card.onclick = () =>
    showDetail(
      movie.title,
      movie.poster,
      movie.desc,
      getTotalEpisodes(movie),
      movie.slug,
    );

  const safeTitle = escapeHtml(movie.title);
  const safeDesc = escapeHtml(movie.desc || "");
  const handlerTitle = escapeForInlineHandler(movie.title);
  const handlerDesc = escapeForInlineHandler(movie.desc || "");

  card.innerHTML = `
    <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
    <h4>${safeTitle}</h4>
    <div class="movie-hover-card">
      <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
      <div class="hover-content">
        <h3 class="hover-title">${safeTitle}</h3>
        <div class="hover-actions">
          <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${movie.slug || ""}')">
            <i class="fa-solid fa-play"></i> Xem ngay
          </button>
          <button
            class="btn-hover icon"
            title="Yêu thích"
            onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
          >
            <i class="fa-regular fa-heart"></i>
          </button>
        </div>
        <p class="hover-genres">${safeDesc}</p>
      </div>
    </div>
  `;
  return card;
}

// Render 1 danh sách phim vào 1 container, có thể truyền HTML hiển thị khi rỗng
function renderMovieGrid(container, movies, emptyHtml = "") {
  if (!container) return;
  container.innerHTML = "";

  if (!movies || movies.length === 0) {
    if (emptyHtml) container.innerHTML = emptyHtml;
    return;
  }

  movies.forEach((movie) => container.appendChild(createMovieCard(movie)));
  updateWishlistUI();
}

// "Phim Mới Cập Nhật" - trả về movies đã fetch để dùng chung cho Hero Banner
async function renderHomePageMovies() {
  const container = document.getElementById("home-movie-slider");
  const movies = await fetchMovies({ limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
  return movies;
}

async function renderAnimeMovies() {
  const container = document.getElementById("anime-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Anime", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderKoreanMovies() {
  const container = document.getElementById("korean-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Hàn Quốc", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderActionMovies() {
  const container = document.getElementById("action-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Hành Động", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderRomanceMovies() {
  const container = document.getElementById("romance-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Tình Cảm", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

function renderMovieParts(currentSlug, currentGroup) {
  const partsSection = document.getElementById("parts-section");
  const partsGrid = document.getElementById("detail-parts-grid");

  if (!partsSection || !partsGrid) return;

  if (!currentGroup) {
    partsSection.style.display = "none";
    return;
  }

  const relatedParts = globalMoviesList.filter((m) => m.group === currentGroup);

  if (relatedParts.length <= 1) {
    partsSection.style.display = "none";
    return;
  }

  partsSection.style.display = "block";
  partsGrid.innerHTML = "";

  relatedParts.forEach((part) => {
    const btn = document.createElement("button");
    btn.className = `episode-btn ${part.slug === currentSlug ? "active" : ""}`;
    btn.innerText = part.partName || part.title;
    btn.onclick = () => {
      showDetail(
        part.title,
        part.poster,
        part.desc,
        getTotalEpisodes(part),
        part.slug,
      );
    };
    partsGrid.appendChild(btn);
  });
}

function renderRelatedSuggestions(currentSlug, currentGenres) {
  const container = document.getElementById("fd-suggestions");
  if (!container) return;

  const genreList = (currentGenres || "")
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  const related = globalMoviesList
    .filter((m) => {
      if (m.slug === currentSlug) return false;
      if (!m.genres) return false;
      const mGenres = m.genres.toLowerCase();
      return genreList.some((g) => g && mGenres.includes(g));
    })
    .slice(0, 6);

  if (related.length === 0) {
    container.innerHTML = `<p style="color:#777; font-size:13px;">Chưa có gợi ý phù hợp.</p>`;
    return;
  }

  container.innerHTML = "";
  related.forEach((movie) => {
    const item = document.createElement("div");
    item.className = "fd-suggest-item";
    item.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );
    item.innerHTML = `
      <img src="${movie.poster}" alt="${escapeHtml(movie.title)}" onerror="this.src='https://placehold.co/80x110'" />
      <div class="fd-suggest-info">
        <h4>${escapeHtml(movie.title)}</h4>
        <span>${escapeHtml((movie.genres || "").split(",")[0] || "")}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH) & TÍCH HỢP TMDB API
// ==========================================

async function fetchMovieDataFromBackend(movieTitle) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tmdb/search?query=${encodeURIComponent(movieTitle)}`,
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const item = data.results[0];
      const isTV = data.isTV ? "true" : "false";

      const detailRes = await fetch(
        `${API_BASE_URL}/api/tmdb/detail/${item.id}?isTV=${isTV}`,
      );
      const detailData = await detailRes.json();

      return detailData;
    }
    return null;
  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu TMDB từ Backend:", error);
    return null;
  }
}

function handleSearch(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    executeSearch();
  }
}

async function executeSearch() {
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim() : "";

  if (!query) return;

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `"${query}"`;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

  const searchContainer = document.getElementById("search-container");
  if (!searchContainer) return;
  searchContainer.innerHTML = `<p style="color:#888; grid-column:1/-1;">Đang tìm kiếm...</p>`;

  const movies = await searchMoviesAPI(query, 40);
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    searchContainer,
    movies,
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Không tìm thấy phim nào phù hợp với từ khóa "${escapeHtml(query)}".</p>
    </div>`,
  );
}

// ==========================================
// 6. CHỨC NĂNG LỌC PHIM THEO THỂ LOẠI (GENRE FILTER)
// ==========================================
async function filterByGenre(genreName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `Thể loại: ${genreName}`;
  }

  const container = document.getElementById("search-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#888; grid-column:1/-1;">Đang tải...</p>`;

  const movies = await fetchMovies({ genre: genreName, limit: 50 });
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    container,
    movies,
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-film" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Hiện chưa có phim nào thuộc thể loại "${escapeHtml(genreName)}".</p>
    </div>`,
  );
}

// ==========================================
// 7. KHỞI TẠO TỔNG THỂ
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  const homeMovies = await renderHomePageMovies();
  initHeroSlider(homeMovies);

  renderAnimeMovies();
  renderKoreanMovies();
  renderActionMovies();
  renderRomanceMovies();
  renderContinueWatching();
});

// ==========================================
// 8. BỔ SUNG XỬ LÝ TOÀN MÀN HÌNH (MOBILE FULLSCREEN FIX)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const videoElement = document.querySelector(".video-player-wrapper video");
  const wrapperElement = document.querySelector(".video-player-wrapper");

  if (videoElement) {
    window.triggerFullscreen = function () {
      if (videoElement.webkitEnterFullscreen) {
        videoElement.webkitEnterFullscreen();
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (wrapperElement && wrapperElement.requestFullscreen) {
        wrapperElement.requestFullscreen();
      } else if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      }
    };
  }
});

// ==========================================
// 9. XỬ LÝ SỰ KIỆN CLICK NÚT MŨI TÊN TRƯỢT SLIDER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const sliderSections = document.querySelectorAll(".slider-section");

  sliderSections.forEach((section) => {
    const slider = section.querySelector(".movie-slider");
    const prevBtn = section.querySelector(".prev-btn");
    const nextBtn = section.querySelector(".next-btn");

    if (slider && nextBtn && prevBtn) {
      nextBtn.addEventListener("click", () => {
        slider.scrollBy({ left: window.innerWidth * 0.75, behavior: "smooth" });
      });

      prevBtn.addEventListener("click", () => {
        slider.scrollBy({
          left: -window.innerWidth * 0.75,
          behavior: "smooth",
        });
      });
    }
  });
});
// ==========================================
// 10. TÍCH HỢP HIỂN THỊ CHI TIẾT TMDB CHO TRANG DETAIL
// ==========================================

function updateRatingVisuals(voteAverage) {
  if (!voteAverage) return;

  const percent = Math.round(voteAverage * 10);
  const scoreEl = document.getElementById("fd-score-value");
  if (scoreEl) scoreEl.innerText = `${percent}%`;

  const starsEl = document.getElementById("fd-stars");
  if (starsEl) {
    const starCount = Math.round(voteAverage / 2);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<i class="${i <= starCount ? "fa-solid" : "fa-regular"} fa-star"></i>`;
    }
    starsEl.innerHTML = html;
  }
}

async function loadMovieDetailsFromTMDB(movieTitle) {
  try {
    const detailData = await fetchMovieDataFromBackend(movieTitle);

    if (detailData) {
      // 1. Cập nhật điểm đánh giá
      const ratingEl = document.getElementById("detail-rating");
      if (ratingEl && detailData.vote_average) {
        ratingEl.innerText = detailData.vote_average.toFixed(1);
      }
      updateRatingVisuals(detailData.vote_average);

      // 2. Cập nhật Đạo diễn
      const directorEl = document.getElementById("detail-director");
      if (directorEl && detailData.director) {
        directorEl.innerText = detailData.director;
      }

      // 3. Cập nhật Diễn viên
      const castEl = document.getElementById("detail-cast");
      if (castEl && detailData.cast) {
        castEl.innerText = detailData.cast;
      }

      // 4. Cập nhật Thể loại
      const genresEl = document.getElementById("detail-genres");
      if (genresEl && detailData.genres) {
        genresEl.innerText = detailData.genres;
      }
    }
  } catch (error) {
    console.error("Không thể tải thông tin chi tiết TMDB:", error);
  }
}

// ==========================================
// 9. ĐIỀU HƯỚNG BẰNG REMOTE TV (PHÍM MŨI TÊN + OK) - KHÔNG CẦN CHUỘT
// ==========================================
// Module này tự chạy độc lập, không cần sửa các hàm render phía trên.
// Cơ chế: mỗi lần bấm phím mũi tên, quét lại toàn bộ phần tử "bấm được"
// đang hiển thị trên trang (card phim, nút, link, ô tìm kiếm...), tìm
// phần tử gần nhất theo đúng hướng vừa bấm (dựa vào toạ độ thực tế trên
// màn hình), rồi focus vào đó. Bấm Enter/OK để "click" phần tử đang focus.
(function initTVRemoteNav() {
  // Danh sách các phần tử được coi là "bấm được" trên toàn site
  const FOCUSABLE_SELECTOR = [
    ".movie-card",
    ".btn-hover",
    ".hero-buttons .btn",
    ".slider-btn",
    ".hero-dot",
    ".ep-btn",
    ".nav-links li",
    ".dropdown-toggle",
    ".genre-grid span",
    "#search-input",
    ".search-btn",
    ".wp-nav-btn",
    ".fd-tab-btn",
    ".fd-watch-btn",
    ".fd-follow-badge",
    ".btn-modal",
    "a[href]",
    "button",
  ].join(", ");

  // Thêm CSS viền nổi bật khi đang focus, để dễ thấy trên màn hình TV
  const style = document.createElement("style");
  style.textContent = `
    .tv-nav-focus {
      outline: 3px solid #e50914 !important;
      outline-offset: 2px !important;
      transform: scale(1.04);
      transition: transform 0.12s ease;
      z-index: 20;
      position: relative;
    }
  `;
  document.head.appendChild(style);

  let lastFocused = null;

  function markFocus(el) {
    if (lastFocused) lastFocused.classList.remove("tv-nav-focus");
    if (el) el.classList.add("tv-nav-focus");
    lastFocused = el;
  }

  // Chỉ lấy phần tử đang thực sự hiển thị (không nằm trong trang/tab ẩn)
  function getFocusableElements() {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null,
    );
  }

  function ensureFocusable(el) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  }

  // Tìm phần tử gần nhất theo đúng hướng bấm, dựa theo toạ độ thật trên
  // màn hình (spatial navigation) - ưu tiên phần tử thẳng hàng nhất trước,
  // sau đó mới đến khoảng cách gần nhất.
  function findNextElement(current, direction) {
    const all = getFocusableElements();
    if (!current) return all[0] || null;

    const rect = current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let best = null;
    let bestScore = Infinity;

    all.forEach((el) => {
      if (el === current) return;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - cx;
      const dy = ey - cy;

      let primary, cross, valid;
      if (direction === "right") {
        valid = dx > 5;
        primary = dx;
        cross = Math.abs(dy);
      } else if (direction === "left") {
        valid = dx < -5;
        primary = -dx;
        cross = Math.abs(dy);
      } else if (direction === "down") {
        valid = dy > 5;
        primary = dy;
        cross = Math.abs(dx);
      } else {
        valid = dy < -5;
        primary = -dy;
        cross = Math.abs(dx);
      }
      if (!valid) return;

      const score = cross * 3 + primary;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  document.addEventListener("keydown", (e) => {
    const directions = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };

    if (directions[e.key]) {
      getFocusableElements().forEach(ensureFocusable);
      const current =
        lastFocused && document.body.contains(lastFocused) ? lastFocused : null;
      const next = findNextElement(current, directions[e.key]);
      if (next) {
        next.focus();
        markFocus(next);
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      const current = lastFocused || document.activeElement;
      // Không tự click nếu đang gõ chữ trong ô tìm kiếm - để nguyên hành vi gõ/Enter tìm kiếm
      if (current && current.tagName !== "INPUT") {
        current.click();
        e.preventDefault();
      }
    }
  });

  // Focus sẵn phần tử đầu tiên khi trang tải xong, để bấm mũi tên là
  // di chuyển được ngay (không cần chạm/click chuột trước)
  window.addEventListener("load", () => {
    const all = getFocusableElements();
    all.forEach(ensureFocusable);
    if (all[0]) {
      all[0].focus();
      markFocus(all[0]);
    }
  });
})();
