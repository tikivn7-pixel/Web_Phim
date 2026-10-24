(function (root) {
  'use strict';
  root.ListControls = {
    mount(movie, element) {
      const P = root.PersonalLists;
      if (!element || !P || !movie?.slug) return () => {};
      element.replaceChildren(); element.classList.add('list-controls');
      const heading = document.createElement('span'); heading.className = 'list-control-label'; heading.textContent = 'Danh sách riêng';
      const row = document.createElement('div'); row.className = 'list-control-row';
      const select = document.createElement('select'); select.setAttribute('aria-label', 'Chọn danh sách riêng cho phim này');
      const button = document.createElement('button'); button.type = 'button';
      const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      const manage = document.createElement('a'); manage.textContent = 'Quản lý danh sách riêng ↗';
      row.append(select, button); element.append(heading, row, manage, status);
      let choice = '', lists = [], disposed = false;
      function link() { manage.href = 'lists.html?' + new URLSearchParams({ movie: movie.slug, ...(choice ? { list: choice } : {}) }); }
      function state() {
        const list = lists.find(item => item.id === choice), added = list?.slugs.includes(movie.slug), full = list?.slugs.length >= P.MAX_MOVIES;
        button.textContent = added ? 'Đã có trong danh sách ✓' : 'Thêm vào danh sách'; button.disabled = !list || added || full;
        button.title = full && !added ? 'Danh sách đã đạt giới hạn ' + P.MAX_MOVIES + ' phim' : added ? 'Phim này đã có trong danh sách đã chọn' : 'Thêm phim vào cuối danh sách'; link();
      }
      function refresh() {
        if (disposed) return;
        try {
          lists = P.active(P.read(undefined, true));
          if (!lists.some(list => list.id === choice)) choice = lists[0]?.id || '';
          const options = lists.map(list => ({ value: list.id, label: list.name }));
          const unchanged = select.options.length === options.length && options.every((option, index) => select.options[index].value === option.value && select.options[index].textContent === option.label);
          if (!unchanged) select.replaceChildren(...options.map(option => new Option(option.label, option.value)));
          select.value = choice; row.hidden = lists.length === 0;
          manage.textContent = lists.length ? 'Mở danh sách đã chọn ↗' : '+ Tạo danh sách cho phim này';
          status.textContent = lists.length ? '' : 'Gom phim cho cuối tuần hoặc những buổi xem cùng bạn bè.';
          state();
        } catch (error) { row.hidden = true; status.textContent = error.message; manage.textContent = 'Kiểm tra danh sách và bản sao lưu ↗'; link(); }
      }
      select.onchange = () => { choice = select.value; status.textContent = ''; state(); };
      button.onclick = () => {
        try {
          const list = P.read(undefined, true).lists[choice];
          if (!list || list.deleted) { refresh(); return; }
          if (list.slugs.includes(movie.slug)) { state(); return; }
          const name = list.name; P.add(choice, movie.slug); refresh(); status.textContent = 'Đã thêm vào “' + name + '”.';
        } catch (error) { status.textContent = error.message; }
      };
      const storage = event => { if (!event.key || event.key === P.KEY) refresh(); };
      root.addEventListener('storage', storage); root.addEventListener('movie-lists-change', refresh); refresh();
      return () => { disposed = true; root.removeEventListener('storage', storage); root.removeEventListener('movie-lists-change', refresh); };
    }
  };
})(globalThis);
