(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RelationEditor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const text = (value, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  function sourceURL(value) {
    const input = typeof value === "string" ? value : value?.url;
    try { const url = new URL(input); return url.protocol === "https:" && !url.username && !url.password && String(input).length <= 2048 ? url.href : null; }
    catch (_) { return null; }
  }
  function normalize(registry, knownSlugs, { allowIncomplete = false } = {}) {
    if (!registry || typeof registry !== "object" || Array.isArray(registry) || !Array.isArray(registry.groups)) throw Error("File phải chứa đối tượng có danh sách groups.");
    if (registry.version !== undefined && registry.version !== 1) throw Error("Phiên bản liên kết chưa được hỗ trợ.");
    if (registry.standalone !== undefined && !Array.isArray(registry.standalone)) throw Error("standalone phải là danh sách phim tách nhóm.");
    const ids = new Set(), slugs = new Set();
    const known = knownSlugs ? new Set(knownSlugs) : null;
    const groups = registry.groups.map(group => {
      if (!group || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(group.id || "") || ids.has(group.id)) throw Error("Mã nhóm không hợp lệ hoặc bị trùng: " + group?.id);
      ids.add(group.id);
      if (!Array.isArray(group.members) || (!allowIncomplete && group.members.length < 2)) throw Error("Nhóm cần ít nhất 2 phim: " + group.id);
      if (!Array.isArray(group.sources) || (!allowIncomplete && group.sources.length === 0)) throw Error("Nhóm cần ít nhất một URL đối chiếu: " + group.id);
      const sources = group.sources.map(source => { const url = sourceURL(source); if (!url) throw Error("Nguồn phải là URL HTTPS hợp lệ: " + group.id); return url; });
      const members = group.members.map((member, index) => {
        const slug = text(member?.slug, 300);
        if (!slug || (known && !known.has(slug))) throw Error("Slug phim không tồn tại: " + slug);
        if (slugs.has(slug)) throw Error("Một phim chỉ thuộc một nhóm chính: " + slug);
        slugs.add(slug);
        if (member.order !== undefined && (!Number.isInteger(member.order) || member.order < 0)) throw Error("Thứ tự phải là số nguyên không âm: " + slug);
        const result = { slug, label: text(member.label) || slug, order: member.order ?? index };
        if (Number.isInteger(member.season) && member.season >= 0) result.season = member.season;
        if (text(member.checkedAt)) result.checkedAt = text(member.checkedAt);
        return result;
      }).sort((a, b) => a.order - b.order).map((member, index) => ({ ...member, order: index }));
      return { id: group.id, label: text(group.label) || group.id, kind: text(group.kind, 50) || "franchise", basis: text(group.basis) || "editor-reviewed", sources: [...new Set(sources)], members };
    });
    const excluded = new Set();
    const standalone = (registry.standalone || []).map(item => {
      const slug = text(item?.slug, 300);
      if (!slug || (known && !known.has(slug))) throw Error("Slug tách nhóm không tồn tại: " + slug);
      if (slugs.has(slug)) throw Error("Phim vừa nằm trong nhóm vừa được tách: " + slug);
      if (excluded.has(slug)) throw Error("Phim tách nhóm bị trùng: " + slug);
      excluded.add(slug);
      const result = { slug, reason: text(item.reason, 1000) || "Tách nhóm theo lựa chọn của người quản lý" };
      if (item.sources) {
        if (!Array.isArray(item.sources)) throw Error("Nguồn tách nhóm phải là danh sách: " + slug);
        result.sources = item.sources.map(source => { const url = sourceURL(source); if (!url) throw Error("Nguồn tách nhóm không hợp lệ: " + slug); return url; });
      }
      return result;
    });
    return { version: 1, policy: "explicit-slugs-only", groups, standalone };
  }
  function membership(registry, slug) { return registry.groups.find(group => group.members.some(member => member.slug === slug)) || null; }
  function exclude(registry, slug) {
    if (!registry.standalone.some(item => item.slug === slug)) registry.standalone.push({ slug, reason: "Tách nhóm từ trang quản lý; không tự nối lại từ metadata" });
  }
  function removeMember(registry, groupID, slug) {
    const result = clone(registry), group = result.groups.find(item => item.id === groupID);
    if (!group) throw Error("Nhóm không tồn tại.");
    if (!group.members.some(item => item.slug === slug)) throw Error("Phim không thuộc nhóm.");
    group.members = group.members.filter(item => item.slug !== slug).map((item, index) => ({ ...item, order: index }));
    exclude(result, slug);
    return result;
  }
  function addMember(registry, groupID, movie) {
    const result = clone(registry), group = result.groups.find(item => item.id === groupID);
    if (!group) throw Error("Nhóm không tồn tại.");
    const existing = membership(result, movie.slug);
    if (existing) throw Error("Phim đã thuộc nhóm “" + existing.label + "”. Hãy tách khỏi nhóm cũ trước.");
    result.standalone = result.standalone.filter(item => item.slug !== movie.slug);
    group.members.push({ slug: movie.slug, label: movie.title, order: group.members.length });
    return result;
  }
  function deleteGroup(registry, groupID) {
    const result = clone(registry), group = result.groups.find(item => item.id === groupID);
    if (!group) throw Error("Nhóm không tồn tại.");
    group.members.forEach(member => exclude(result, member.slug));
    result.groups = result.groups.filter(item => item.id !== groupID);
    return result;
  }
  function moveMember(registry, groupID, slug, direction) {
    const result = clone(registry), group = result.groups.find(item => item.id === groupID);
    if (!group) throw Error("Nhóm không tồn tại.");
    const index = group.members.findIndex(item => item.slug === slug), target = index + direction;
    if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= group.members.length) return result;
    [group.members[index], group.members[target]] = [group.members[target], group.members[index]];
    group.members.forEach((item, order) => { item.order = order; });
    return result;
  }
  function makeID(label) {
    return String(label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  }
  return { normalize, membership, removeMember, addMember, deleteGroup, moveMember, makeID };
});
