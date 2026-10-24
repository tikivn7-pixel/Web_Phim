(function(root){'use strict';
 function mount(movie,host){
  let dirty=false,disposed=false,loaded=0;
  host.classList.add('note-controls');host.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Ghi chú của tôi';
  const hint=document.createElement('p');hint.textContent='Chỉ lưu trên trình duyệt này. Xuất bản sao lưu trong Thư viện để giữ lại.';
  const label=document.createElement('label');label.textContent='Cảm nhận, chi tiết muốn nhớ';
  const input=document.createElement('textarea');input.maxLength=10000;input.rows=4;input.placeholder='Viết điều bạn muốn nhớ về phim…';input.className='movie-note-text';label.append(input);
  const spoilerLabel=document.createElement('label');spoilerLabel.className='note-spoiler-choice';const spoiler=document.createElement('input');spoiler.type='checkbox';spoiler.className='movie-note-spoiler';spoilerLabel.append(spoiler,document.createTextNode('Có nội dung tiết lộ phim'));
  const actions=document.createElement('div');actions.className='note-actions';const save=document.createElement('button');save.type='button';save.textContent='Lưu ghi chú';save.className='movie-note-save';const status=document.createElement('p');status.setAttribute('role','status');status.className='movie-note-status';const link=document.createElement('a');link.href='notes.html';link.textContent='Mở sổ tay →';actions.append(save,link);host.append(heading,hint,label,spoilerLabel,actions,status);
  function fill(){const n=root.MovieNotes.get(movie.slug)?.note;input.value=n?.text||'';spoiler.checked=!!n?.spoiler;loaded=n?.updatedAt||0;dirty=false;}
  fill();const change=()=>{dirty=true;status.textContent='Chưa lưu';};input.addEventListener('input',change);spoiler.addEventListener('change',change);
  save.onclick=()=>{try{const now=root.MovieNotes.get(movie.slug)?.note?.updatedAt||0;if(now!==loaded&&!confirm('Ghi chú đã thay đổi ở nơi khác. Ghi đè bằng nội dung đang soạn?'))return;root.MovieNotes.setNote(movie.slug,{text:input.value,spoiler:spoiler.checked});fill();status.textContent=input.value?'Đã lưu ghi chú.':'Đã xóa nội dung ghi chú.';}catch(error){status.textContent=error.message;}};
  const sync=event=>{if(event.type==='storage'&&event.key!==root.MovieNotes.KEY)return;if(event.detail?.slug&&event.detail.slug!==movie.slug)return;if(dirty){status.textContent='Có cập nhật ở nơi khác. Bản đang soạn vẫn được giữ.';}else fill();};
  const leave=e=>{if(dirty&&!disposed){e.preventDefault();e.returnValue='';}};
  root.addEventListener('storage',sync);root.addEventListener('movie-notes-change',sync);root.addEventListener('beforeunload',leave);
  return ()=>{disposed=true;root.removeEventListener('storage',sync);root.removeEventListener('movie-notes-change',sync);root.removeEventListener('beforeunload',leave);};
 }root.NoteControls={mount};
})(globalThis);
