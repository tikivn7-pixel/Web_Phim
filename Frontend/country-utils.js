(function (root) {
  const LEGACY_COUNTRIES = ["Trung Quốc", "Hàn Quốc", "Mỹ", "Nhật Bản", "Việt Nam", "Thái Lan", "Anh", "Pháp", "Đài Loan", "Hồng Kông", "Ấn Độ"];
  const COUNTRIES = [...LEGACY_COUNTRIES, "Ba Lan", "Bỉ", "Brunei Darussalam", "Canada", "Chile", "Comoros", "Đan Mạch", "Đức", "Indonesia", "Ireland", "Malaysia", "Mexico", "Mông Cổ", "Nga", "Philippines", "Singapore", "Thụy Sĩ", "Úc"];
  const canonical = value => {
    const text = String(value || "").trim();
    if (text.toLowerCase() === "âu mỹ") return "Mỹ";
    if (text.toLowerCase() === "mongolia") return "Mông Cổ";
    return COUNTRIES.find(country => country.toLowerCase() === text.toLowerCase()) || "";
  };
  function genreCountries(movie) {
    return [...new Set([...String(movie?.genres || "").split(","),...(Array.isArray(movie?.sourceCountries)?movie.sourceCountries:[])].map(canonical).filter(Boolean))];
  }
  function primaryCountry(movie) {
    if (!movie) return "";
    // An explicit editorial country wins. Legacy fallback respects source order,
    // never the arbitrary order of the navigation menu.
    if (typeof movie.country === "string" && movie.country.trim()) return canonical(movie.country) || movie.country.trim();
    const countries = genreCountries(movie);
    // Preserve the previously selected primary for legacy imports; extra country
    // tags are unreviewed metadata, not a reason to reclassify an existing film.
    return countries.find(country => LEGACY_COUNTRIES.includes(country)) || countries[0] || "";
  }
  const api = { COUNTRIES, genreCountries, primaryCountry, canonical };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MovieCountries = api;
})(globalThis);
