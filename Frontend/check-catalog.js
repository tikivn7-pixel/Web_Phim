// node Frontend/check-catalog.js [--check-images] [--max=30]
const { readMovies, validateMovies } = require("./catalog-tools");
const { audit } = require("./catalog-audit");
const { genreCountries } = require("./country-utils");
async function main() {
  const movies = readMovies();
  const report = validateMovies(movies);
  const detailed=audit(movies.map(movie=>({...movie,sourceCountries:genreCountries(movie)})));
  if (process.argv.includes("--check-images")) {
    const maxArg = process.argv.find(a => a.startsWith("--max="));
    const max = maxArg ? Math.max(1, Number(maxArg.split("=")[1]) || 30) : movies.length;
    const urls = [...new Set(movies.flatMap(m => [m.poster, m.banner]).filter(u => /^https?:\/\//i.test(u || "")))].slice(0, max);
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(10000) });
          await res.body?.cancel();
          if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) report.warnings.push(`Ảnh cần kiểm tra: HTTP ${res.status} ${url}`);
        } catch (err) { report.warnings.push(`Không kiểm tra được ảnh: ${url} (${err.cause?.code || err.message})`); }
      }
    }));
    console.log(`Đã kiểm tra ${urls.length} URL ảnh (lỗi mạng không đồng nghĩa link đã mất).`);
  }
  console.log(`${report.total} phim | ${report.errors.length} lỗi | ${report.warnings.length} cảnh báo`);
  console.log(`Rà soát sâu: ${detailed.errors} lỗi, ${detailed.warnings} mục cần đối chiếu. Chạy catalog:build để xuất báo cáo đầy đủ hoặc mở manage.html.`);
  report.errors.forEach(item => console.error("LỖI:", item));
  report.warnings.forEach(item => console.warn("CẢNH BÁO:", item));
  if (report.errors.length) process.exitCode = 1;
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
