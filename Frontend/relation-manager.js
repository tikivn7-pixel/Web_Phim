(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.RelationEditor;
  const DRAFT = "catalog_relations_draft_v1";
  let registry, original, selected = null, getMovies = () => [], onChange = () => {}, beforeOpen = () => true;
  let dirty = false, storageFailed = false, limit = 40, loaded = false;
  const folded = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  const known = () => new Set(getMovies().map(movie => movie.slug));
  const group = () => registry?.groups.find(item => item.id === selected);
  const tell = (message, error = false) => { $("relations-status").textContent = message; $("relations-status").classList.toggle("error", error); };
  const setDirty = value => { dirty = value; $("relation-dirty").textContent = value ? "Tên / nguồn đang sửa, chưa lưu." : ""; };
  function persist() {
    try { localStorage.setItem(DRAFT, JSON.stringify(registry)); storageFailed = false; }
    catch (_) { storageFailed = true; tell("Thay đổi chỉ còn trong phiên này vì bộ nhớ đầy hoặc bị chặn. Hãy xuất JSON trước khi đóng trang.", true); }
    onChange(registry);
  }
  function download(value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "movie-relations-import.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function guard() { return !dirty || window.confirm("Tên hoặc nguồn của nhóm chưa lưu. Bỏ các thay đổi trong ô nhập này?"); }
  function showRelations(slug) {
    if (!beforeOpen()) return;
    $("catalog-panel").hidden = true; $("relations-panel").hidden = false;
    $("tab-catalog").setAttribute("aria-pressed", "false"); $("tab-relations").setAttribute("aria-pressed", "true");
    if (slug && loaded) {
      const target = core.membership(registry, slug);
      if (target && (target.id === selected || guard())) select(target.id);
      else if (!target) { $("relation-movie-search").value = getMovies().find(movie => movie.slug === slug)?.title || slug; searchMovies(); tell("Phim chưa có nhóm. Chọn một nhóm để thêm hoặc tạo nhóm mới."); }
    }
    $("relations-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function drawList() {
    const query = folded($("relations-search").value), movies = new Map(getMovies().map(movie => [movie.slug, movie]));
    const items = registry.groups.filter(item => folded(item.label + " " + item.id + " " + item.members.map(member => member.slug + " " + movies.get(member.slug)?.title).join(" ")).includes(query));
    $("relations-count").textContent = `(${registry.groups.length})`;
    const node = $("relations-list"); node.replaceChildren();
    for (const item of items.slice(0, limit)) {
      const button = document.createElement("button"); button.className = "movie-row" + (item.id === selected ? " active" : "");
      button.textContent = `${item.label} · ${item.members.length} phim`;
      button.onclick = () => { if (item.id === selected || guard()) select(item.id); }; node.append(button);
    }
    if (!items.length) { const p = document.createElement("p"); p.textContent = "Không tìm thấy nhóm. Bạn có thể tạo nhóm mới."; node.append(p); }
    $("relations-more").hidden = items.length <= limit;
  }
  function drawPreview() {
    const target = $("relation-preview-parts"); target.replaceChildren();
    for (const member of group()?.members || []) {
      const chip = document.createElement("span"); chip.className = "relation-part-chip"; chip.textContent = member.label || member.slug; target.append(chip);
    }
  }
  function drawMembers() {
    const current = group(), movies = new Map(getMovies().map(movie => [movie.slug, movie]));
    $("relation-members").replaceChildren(); $("relation-member-count").textContent = `(${current.members.length})`;
    current.members.forEach((member, index) => {
      const li = document.createElement("li"), heading = document.createElement("strong"), slug = document.createElement("small"), label = document.createElement("label"), input = document.createElement("input"), actions = document.createElement("div");
      heading.textContent = movies.get(member.slug)?.title || member.slug; slug.textContent = member.slug; label.textContent = "Tên phần hiển thị";
      input.value = member.label; input.maxLength = 500; input.setAttribute("aria-label", "Tên phần: " + heading.textContent);
      input.oninput = () => { member.label = input.value; persist(); drawPreview(); };
      input.onblur = () => { member.label = input.value.trim() || movies.get(member.slug)?.title || member.slug; input.value = member.label; persist(); drawPreview(); };
      label.append(input); actions.className = "actions";
      for (const [text, direction] of [["↑", -1], ["↓", 1]]) {
        const button = document.createElement("button"); button.textContent = text; button.disabled = direction === -1 ? index === 0 : index === current.members.length - 1;
        button.setAttribute("aria-label", `${direction === -1 ? "Đưa lên" : "Đưa xuống"}: ${heading.textContent}`);
        button.onclick = () => { registry = core.moveMember(registry, selected, member.slug, direction); persist(); drawMembers(); }; actions.append(button);
      }
      const detach = document.createElement("button"); detach.textContent = "Tách"; detach.className = "danger"; detach.setAttribute("aria-label", "Tách khỏi nhóm: " + heading.textContent);
      detach.onclick = () => { registry = core.removeMember(registry, selected, member.slug); persist(); drawMembers(); drawList(); searchMovies(); tell("Đã tách phim. Liên kết sẽ không tự xuất hiện lại sau khi nhập file. Nhóm cần ít nhất hai phim để xuất."); };
      actions.append(detach); li.append(heading, slug, label, actions); $("relation-members").append(li);
    });
    drawPreview();
  }
  function select(id) {
    selected = id; const current = group(); setDirty(false);
    $("relation-empty").hidden = Boolean(current); $("relation-edit-content").hidden = !current;
    if (current) { $("relation-label").value = current.label; $("relation-id").value = current.id; $("relation-sources").value = current.sources.map(item => typeof item === "string" ? item : item.url).join("\n"); drawMembers(); searchMovies(); }
    drawList();
  }
  function searchMovies() {
    const query = folded($("relation-movie-search").value.trim()), target = $("relation-movie-results"); target.replaceChildren();
    if (!group() || query.length < 2) return;
    const matches = getMovies().filter(movie => folded(movie.title + " " + movie.slug).includes(query));
    const summary = document.createElement("p"); summary.className = "field-help"; summary.textContent = `${matches.length} kết quả; hiển thị tối đa 20. Nhập thêm để tìm chính xác.`; target.append(summary);
    for (const movie of matches.slice(0, 20)) {
      const row = document.createElement("div"), title = document.createElement("span"), add = document.createElement("button"), existing = core.membership(registry, movie.slug);
      row.className = "relation-search-row"; title.textContent = `${movie.title} (${movie.year || "?"}) · ${movie.slug}`;
      add.textContent = existing ? (existing.id === selected ? "Đã thêm" : "Ở nhóm khác") : "Thêm"; add.disabled = Boolean(existing);
      if (existing) add.title = existing.label;
      add.onclick = () => { try { registry = core.addMember(registry, selected, movie); persist(); drawMembers(); drawList(); searchMovies(); tell("Đã thêm phim vào bản nháp liên kết."); } catch (error) { tell(error.message, true); } };
      row.append(title, add); target.append(row);
    }
  }
  function saveMetadata() {
    if (!group()) return true;
    try {
      if (!$("relation-group-form").reportValidity()) return false;
      const next = JSON.parse(JSON.stringify(registry)), current = next.groups.find(item => item.id === selected);
      current.label = $("relation-label").value.trim(); current.sources = $("relation-sources").value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      registry = core.normalize(next, known(), { allowIncomplete: true }); setDirty(false); persist(); drawList(); drawMembers(); tell("Đã lưu nhóm vào bản nháp. Xuất JSON khi sửa xong."); return true;
    } catch (error) { tell(error.message, true); return false; }
  }
  function setupCreateDialog() {
    const dialog = document.createElement("dialog"); dialog.className = "relation-dialog";
    dialog.innerHTML = '<form id="relation-create-form"><h2>Tạo nhóm phim</h2><label>Tên nhóm<input name="label" required maxlength="500"></label><label>Mã nhóm (cố định sau khi tạo)<input name="id" required pattern="[a-z0-9][a-z0-9-]{0,119}" maxlength="120"></label><label>Nguồn đối chiếu HTTPS<textarea name="sources" rows="3" required placeholder="https://..."></textarea></label><p id="relation-create-error" class="error" role="alert"></p><div class="actions"><button type="submit">Tạo nhóm</button><button type="button" id="relation-create-cancel">Hủy</button></div></form>';
    document.body.append(dialog); const form = $("relation-create-form");
    form.elements.namedItem("label").oninput = () => { if (!form.elements.namedItem("id").dataset.edited) form.elements.namedItem("id").value = core.makeID(form.elements.namedItem("label").value); };
    form.elements.namedItem("id").oninput = () => { form.elements.namedItem("id").dataset.edited = "yes"; };
    $("relation-create-cancel").onclick = () => dialog.close();
    form.onsubmit = event => {
      event.preventDefault();
      try {
        const item = { id: form.elements.namedItem("id").value.trim(), label: form.elements.namedItem("label").value.trim(), sources: form.elements.namedItem("sources").value.split(/\r?\n/).map(value => value.trim()).filter(Boolean), members: [] };
        registry = core.normalize({ ...registry, groups: [...registry.groups, item] }, known(), { allowIncomplete: true }); persist(); select(item.id); dialog.close(); tell("Đã tạo nhóm. Tìm và thêm ít nhất hai phim, rồi xuất JSON.");
      } catch (error) { $("relation-create-error").textContent = error.message; }
    };
    $("relations-new").onclick = () => { if (!loaded || !guard()) return; form.reset(); delete form.elements.namedItem("id").dataset.edited; $("relation-create-error").textContent = ""; dialog.showModal(); };
  }
  async function init(options) {
    getMovies = options.getMovies; onChange = options.onChange || onChange; beforeOpen = options.beforeOpen || beforeOpen;
    $("tab-relations").onclick = () => showRelations();
    $("tab-catalog").onclick = () => { if (!guard()) return; if (dirty) select(selected); $("catalog-panel").hidden = false; $("relations-panel").hidden = true; $("tab-catalog").setAttribute("aria-pressed", "true"); $("tab-relations").setAttribute("aria-pressed", "false"); };
    setupCreateDialog();
    window.addEventListener("beforeunload", event => { if (dirty || storageFailed) { event.preventDefault(); event.returnValue = ""; } });
    try {
      const response = await fetch("data/movie-relations.json", { cache: "no-cache" }); if (!response.ok) throw Error("Chưa tải được file liên kết. Chạy npm run catalog:build rồi tải lại trang.");
      original = core.normalize(await response.json(), known()); registry = JSON.parse(JSON.stringify(original));
      let draftMessage = "";
      try { const draft = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (draft) { registry = core.normalize(draft, known(), { allowIncomplete: true }); draftMessage = " Đang mở bản nháp đã lưu trên thiết bị."; } }
      catch (_) { draftMessage = " Bản nháp cũ không khớp kho phim; dữ liệu website đã được dùng. File nháp cũ vẫn được giữ trong bộ nhớ."; }
      loaded = true; select(registry.groups[0]?.id || null); onChange(registry); tell(`Đã tải ${registry.groups.length} nhóm; thay đổi chỉ áp dụng sau khi nhập file vào dự án.${draftMessage}`);
    } catch (error) { tell(error.message, true); return; }
    $("relations-search").oninput = () => { limit = 40; drawList(); }; $("relations-more").onclick = () => { limit += 40; drawList(); };
    $("relation-movie-search").oninput = searchMovies; $("relation-group-form").oninput = () => setDirty(true);
    $("relation-group-form").onsubmit = event => { event.preventDefault(); saveMetadata(); };
    $("relation-delete").onclick = () => {
      if (!group() || !window.confirm("Xóa nhóm “" + group().label + "”? Phim vẫn còn trong kho, các thành viên sẽ được tách liên kết.")) return;
      registry = core.deleteGroup(registry, selected); persist(); select(registry.groups[0]?.id || null); tell("Đã xóa nhóm khỏi bản nháp. Các phim trong nhóm sẽ không tự nối lại.");
    };
    $("relations-export").onclick = () => {
      if (dirty && !saveMetadata()) return;
      try { const output = core.normalize(registry, known()); download(output); tell(`Đã xuất ${output.groups.length} nhóm. Chạy npm run relations:import với file vừa tải để cập nhật website.`); }
      catch (error) { tell(error.message + " Nhóm chưa đủ hai phim cần thêm thành viên hoặc xóa nhóm trước khi xuất.", true); }
    };
    $("relations-import").onchange = async event => {
      try {
        const file = event.target.files[0]; if (!file) return;
        if (file.size > 10 * 1024 * 1024) throw Error("File liên kết vượt quá 10 MB.");
        const next = core.normalize(JSON.parse(await file.text()), known());
        if (!window.confirm("Thay toàn bộ bản nháp liên kết bằng " + next.groups.length + " nhóm trong file này?")) return;
        registry = next; persist(); select(registry.groups[0]?.id || null); tell("Đã nhập vào bản nháp liên kết. Website hiện tại chưa thay đổi.");
      } catch (error) { tell(error.message, true); } finally { event.target.value = ""; }
    };
    $("relations-reset").onclick = () => {
      if (!window.confirm("Bỏ toàn bộ bản nháp liên kết và trở về nhóm đang có trên website?")) return;
      registry = JSON.parse(JSON.stringify(original)); try { localStorage.removeItem(DRAFT); storageFailed = false; } catch (_) {}
      select(registry.groups[0]?.id || null); onChange(registry); tell("Đã trở về liên kết đang có trên website.");
    };
  }
  window.RelationsManager = { init, openForMovie: showRelations, membership: slug => registry ? core.membership(registry, slug) : null, isReady: () => loaded };
})();
