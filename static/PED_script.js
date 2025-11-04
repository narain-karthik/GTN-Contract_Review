// PED Review — Admin full access; dept-limited cycles/notes; header + item fields admin-only
// + Shared CSV via File System Access API (Open / Reload / Save)
(function () {
  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');
  if (!dept) { window.location.href = 'login.html'; return; }

  // PED cycles: 8 Eng, 1 Mfg, 1 Mat, 1 Purchase = 11
  const PED_GROUPS = [
    {key:'engineering', count:8},
    {key:'manufacturing', count:1},
    {key:'materials', count:1},
    {key:'purchase', count:1}
  ];
  const NOTE_DEPTS = ['special-process','welding','assembly','quality','painting','customer-service','commercial'];

  function pedAllowedSet(currentDept){
    if (isAdmin) return null;
    let start = 0;
    for (const g of PED_GROUPS){
      const end = start + g.count - 1;
      if (g.key === currentDept) {
        const s = new Set();
        for (let i=start;i<=end;i++) s.add(i);
        return s;
      }
      start += g.count;
    }
    return new Set();
  }

  // ---------- UI refs ----------
  const addPedBtn = document.getElementById('addItemBtnPed');
  const printBtnPed = document.getElementById('printBtnPed');
  const resetBtnPed = document.getElementById('resetBtnPed');
  const exportCsvPedBtn = document.getElementById('exportCsvPed');
  const exportTxtPedBtn = document.getElementById('exportTxtPed');

  // New shared CSV buttons
  const openSharedBtn = document.getElementById('openSharedCsvPed');   // Add in HTML
  const reloadSharedBtn = document.getElementById('reloadSharedCsvPed');
  const saveSharedBtn = document.getElementById('saveSharedCsvPed');
  const fileNameBadge = document.getElementById('sharedCsvNamePed');   // optional span

  // ---------- Table wiring ----------
  function makeCycleFocusable(td) {
    td.tabIndex = 0;
    td.setAttribute('role', 'button');
    td.setAttribute('aria-pressed', 'false');
  }
  function togglePedCycle(td) {
    if (td.dataset.locked === '1') return;
    const pedStates = ['', '✓', 'x', 'NA'];
    const current = td.textContent.trim();
    let idx = pedStates.indexOf(current);
    if (idx === -1) idx = 0;
    const next = pedStates[(idx + 1) % pedStates.length];
    td.textContent = next;
    td.classList.remove('state-yes', 'state-no', 'state-na');
    if (next === '✓') td.classList.add('state-yes');
    if (next === 'x') td.classList.add('state-no');
    if (next === 'NA') td.classList.add('state-na');
    td.setAttribute('aria-pressed', next !== '' ? 'true' : 'false');
  }

  function initPedRowDelegation() {
    const tbody = document.getElementById('tbody-ped');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
      const td = e.target.closest('td');
      if (!td || !tbody.contains(td)) return;

      if (e.target.matches('.del-row')) {
        if (!isAdmin) { alert('Only Admin can delete rows.'); return; }
        const tr = e.target.closest('tr');
        if (!tr) return;
        if (!confirm('Delete this row?')) return;
        tr.remove();
        return;
      }
      if (td.classList.contains('cycle')) {
        togglePedCycle(td);
        return;
      }
      if (td.classList.contains('dept-note')) {
        if (td.dataset.locked === '1') return;
        // Double click toggler for quick marks
        if (e.detail === 2) {
          const states = ['✓', 'x', 'NA', ''];
          let idx = parseInt(td.dataset.toggleIndex || (states.length-1), 10);
          idx = (idx + 1) % states.length;
          td.innerText = states[idx];
          td.dataset.toggleIndex = String(idx);
          td.setAttribute('aria-pressed', states[idx] !== '' ? 'true' : 'false');
        }
        return;
      }
    });

    tbody.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t.classList.contains('cycle')) {
        if (t.dataset.locked === '1') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePedCycle(t); }
      }
      if (t.classList.contains('dept-note')) {
        if (t.dataset.locked === '1') return;
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          const states = ['✓', 'x', 'NA', ''];
          let idx = parseInt(t.dataset.toggleIndex || (states.length-1), 10);
          idx = (idx + 1) % states.length;
          t.innerText = states[idx];
          t.dataset.toggleIndex = String(idx);
          t.setAttribute('aria-pressed', states[idx] !== '' ? 'true' : 'false');
        }
      }
    });
  }

  function createPedEditable(classes = '') {
    const td = document.createElement('td');
    td.contentEditable = isAdmin ? "true" : "false";
    td.className = 'editable bordered ' + (classes || '') + (isAdmin ? '' : ' locked-edit');
    td.innerHTML = '';
    return td;
  }
  function createDeptEditable() {
    const td = document.createElement('td');
    td.contentEditable = isAdmin ? "true" : "false";
    td.className = 'editable bordered dept-note' + (isAdmin ? '' : ' locked-edit');
    td.innerHTML = '';
    td.tabIndex = 0; td.setAttribute('role','button'); td.dataset.toggleIndex='3';
    return td;
  }
  function createPedCycleCell() {
    const td = document.createElement('td');
    td.className = 'cycle';
    td.innerText = '';
    makeCycleFocusable(td);
    return td;
  }

  function getNextItemNumberForTbody(tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length) return 10;
    let max = 0;
    rows.forEach(r => {
      const td = r.querySelector('td.fixed');
      if (!td) return;
      const v = parseInt(td.textContent.trim());
      if (!isNaN(v) && v > max) max = v;
    });
    return (max === 0) ? 10 : max + 10;
  }

  function addPedRow(itemNo) {
    const tbody = document.getElementById('tbody-ped');
    if (!tbody) return;
    const tr = document.createElement('tr');

    const tdItem = document.createElement('td'); tdItem.className = 'fixed'; tdItem.textContent = itemNo; tr.appendChild(tdItem);
    tr.appendChild(createPedEditable()); // Part #
    tr.appendChild(createPedEditable()); // Part Desc
    const rev = createPedEditable('small'); rev.classList.add('fixed'); tr.appendChild(rev);
    const qty = createPedEditable('small'); qty.classList.add('fixed'); tr.appendChild(qty);

    for (let i=0;i<11;i++){ tr.appendChild(createPedCycleCell()); }
    for (let i=0;i<7;i++){ tr.appendChild(createDeptEditable()); }

    const remarks = document.createElement('td');
    remarks.contentEditable = isAdmin ? "true" : "false";
    remarks.className = 'editable bordered' + (isAdmin ? '' : ' locked-edit');
    tr.appendChild(remarks);

    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    const del = document.createElement('button'); del.className = 'del-row'; del.type = 'button'; del.textContent = 'Delete';
    tdAct.appendChild(del); tr.appendChild(tdAct);

    tbody.appendChild(tr);
    enforcePEDAccess();
    tr.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  // ---------- Locks ----------
  function enforcePEDAccess(){
    const tbody = document.getElementById('tbody-ped');
    if (!tbody) return;

    const allowed = pedAllowedSet(dept);
    tbody.querySelectorAll('tr').forEach(tr => {
      const cycles = Array.from(tr.querySelectorAll('td.cycle'));
      cycles.forEach((td, idx) => {
        const can = isAdmin || (allowed && allowed.has(idx));
        if (can) { td.dataset.locked = '0'; td.style.pointerEvents = 'auto'; td.style.opacity = '1'; }
        else { td.dataset.locked = '1'; td.style.pointerEvents = 'none'; td.style.opacity = '0.5'; }
      });

      const notes = Array.from(tr.querySelectorAll('td.dept-note'));
      notes.forEach((td, noteIdx) => {
        const noteDept = NOTE_DEPTS[noteIdx];
        const canNote = isAdmin || (dept === noteDept);
        if (canNote) {
          td.dataset.locked = '0';
          td.contentEditable = "true";
          td.style.opacity = '1';
        } else {
          td.dataset.locked = '1';
          td.contentEditable = "false";
          td.style.opacity = '0.6';
        }
      });

      if (!isAdmin) {
        // Lock base columns
        const tds = Array.from(tr.children);
        for (let i=0;i<tds.length;i++){
          if (i<=4) {
            tds[i].contentEditable = "false";
            tds[i].classList.add('locked-edit');
          }
        }
      }
    });
  }

  function lockHeaderFields() {
    if (isAdmin) return;
    const ids = ['customerName', 'customerSelect', 'bidDt', 'poRevDt', 'crRevDt'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = true; el.classList.add('locked-edit'); }
    });
  }

  // ---------- CSV helpers ----------
  function parseCSV(text){
    const rows = [];
    let i=0, field='', row=[], inQuotes=false;
    while (i < text.length){
      const c = text[i];
      if (inQuotes){
        if (c === '"'){
          if (text[i+1] === '"'){ field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"'){ inQuotes = true; }
        else if (c === ','){ row.push(field); field=''; }
        else if (c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
        else if (c === '\r'){ /* ignore */ }
        else { field += c; }
      }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function toCSV(rows){
    return rows.map(cols => cols.map(v=>{
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(',')).join('\n');
  }

  function trToPedRow(tr){
    const tds = Array.from(tr.children);
    const key = (tds[0]?.innerText || '').trim();
    const part = (tds[1]?.innerText || '').trim();
    const desc = (tds[2]?.innerText || '').trim();
    const rev = (tds[3]?.innerText || '').trim();
    const qty = (tds[4]?.innerText || '').trim();
    const pedCycles = tds.slice(5, 16).map(td => td.innerText.trim()); // 11
    const notes = tds.slice(16, 23).map(td => td.innerText.trim());    // 7
    const remarks = (tds[23]?.innerText || '').trim();
    return { key, part, desc, rev, qty, pedCycles, notes, remarks };
  }
  function buildPEDMapFromDOM(){
    const map = new Map();
    document.querySelectorAll('#tbody-ped tr').forEach(tr=>{
      const r = trToPedRow(tr);
      if (r.key) map.set(r.key, r);
    });
    return map;
  }
  function applyPEDDataToDOM(dataRows){
    const byKey = new Map(dataRows.map(r => [String(r.key), r]));
    document.querySelectorAll('#tbody-ped tr').forEach(tr=>{
      const tds = Array.from(tr.children);
      const key = (tds[0]?.innerText || '').trim();
      if (!key || !byKey.has(key)) return;
      const r = byKey.get(key);
      if (tds[1]) tds[1].innerText = r.part ?? '';
      if (tds[2]) tds[2].innerText = r.desc ?? '';
      if (tds[3]) tds[3].innerText = r.rev ?? '';
      if (tds[4]) tds[4].innerText = r.qty ?? '';
      // PED cycles (11)
      const cyclesTds = tds.slice(5, 16);
      cyclesTds.forEach((td, idx)=>{
        const val = (r.pedCycles || [])[idx] ?? '';
        td.innerText = val;
        td.classList.remove('state-yes','state-no','state-na');
        if (val === '✓') td.classList.add('state-yes');
        else if (val === 'x') td.classList.add('state-no');
        else if (val === 'NA') td.classList.add('state-na');
      });
      // Dept-notes (7)
      const noteTds = tds.slice(16, 23);
      noteTds.forEach((td, idx)=>{ td.innerText = (r.notes || [])[idx] ?? ''; });
      // Remarks
      if (tds[23]) tds[23].innerText = r.remarks ?? '';
    });
  }

  // CSV mapping (header first)
  function makePEDHeader(){
    const header = ['ItemNo','PartNumber','PartDescription','Rev','Qty'];
    for (let i=1;i<=11;i++) header.push(`PED${i}`);
    header.push('Note_SP','Note_Welding','Note_Assembly','Note_Quality','Note_Painting','Note_CS','Note_Commercial','Remarks');
    return header;
  }
  function csvRowsToPEDObjects(rows){
    if (!rows || rows.length===0) return [];
    const first = rows[0].map(c=>c.trim().toLowerCase());
    let startIdx = 0;
    let hasHeader = false;
    if (first.includes('itemno') && first.includes('partnumber')) { hasHeader = true; startIdx = 1; }
    const colIndex = (name) => first.indexOf(name.toLowerCase());
    const idxItem = hasHeader ? colIndex('itemno') : 0;
    const idxPart = hasHeader ? colIndex('partnumber') : 1;
    const idxDesc = hasHeader ? colIndex('partdescription') : 2;
    const idxRev  = hasHeader ? colIndex('rev') : 3;
    const idxQty  = hasHeader ? colIndex('qty') : 4;
    const pedStart = hasHeader ? 5 : 5;
    const noteStart = pedStart + 11;
    const rowsOut = [];
    for (let r=startIdx;r<rows.length;r++){
      const row = rows[r];
      if (!row || row.length===0) continue;
      const key = (row[idxItem] ?? '').trim();
      if (!key) continue;
      const part = (row[idxPart] ?? '').trim();
      const desc = (row[idxDesc] ?? '').trim();
      const rev  = (row[idxRev] ?? '').trim();
      const qty  = (row[idxQty] ?? '').trim();
      const pedCycles = [];
      for (let i=0;i<11;i++){ pedCycles.push((row[pedStart+i] ?? '').trim()); }
      const notes = [];
      for (let i=0;i<7;i++){ notes.push((row[noteStart+i] ?? '').trim()); }
      const remarks = (row[noteStart+7] ?? '').trim();
      rowsOut.push({ key, part, desc, rev, qty, pedCycles, notes, remarks });
    }
    return rowsOut;
  }
  function pedObjectsToCsvRows(objs){
    const header = makePEDHeader();
    const rows = [header];
    objs.forEach(r=>{
      const row = [r.key, r.part, r.desc, r.rev, r.qty, ...(r.pedCycles || []), ...(r.notes || [])];
      row.push(r.remarks ?? '');
      rows.push(row);
    });
    return rows;
  }

  // Shared CSV state
  let pedCsvHandle = null;

  async function openSharedCsv(){
    if (!window.showOpenFilePicker){ alert('Your browser does not support the File System Access API. Use Chrome or Edge.'); return; }
    try{
      const [handle] = await window.showOpenFilePicker({
        multiple:false,
        types:[{ description:'CSV', accept:{ 'text/csv':['.csv'] } }]
      });
      pedCsvHandle = handle;
      if (fileNameBadge) fileNameBadge.textContent = handle.name || 'Shared CSV';
      await reloadSharedCsv();
    }catch(e){ /* canceled */ }
  }

  async function reloadSharedCsv(){
    if (!pedCsvHandle){ await openSharedCsv(); return; }
    try{
      const file = await pedCsvHandle.getFile();
      const text = await file.text();
      const rows = parseCSV(text);
      const objs = csvRowsToPEDObjects(rows);
      applyPEDDataToDOM(objs);
      enforcePEDAccess();
      alert('Shared CSV reloaded.');
    }catch(e){
      console.error(e);
      alert('Failed to reload CSV.');
    }
  }

  function mergeNonAdminPED(existingRows){
    const existingMap = new Map(existingRows.map(r=>[String(r.key), r]));
    const domMap = buildPEDMapFromDOM();
    const allowed = pedAllowedSet(dept);
    const noteIndex = NOTE_DEPTS.indexOf(dept); // which note cell this dept controls (0..6 or -1)
    existingMap.forEach((er, key) => {
      const domRow = domMap.get(key);
      if (!domRow) return;
      // allowed ped cycles
      if (allowed && allowed.size){
        er.pedCycles = er.pedCycles || [];
        for (let i=0;i<11;i++){
          if (allowed.has(i)){
            er.pedCycles[i] = (domRow.pedCycles || [])[i] ?? '';
          }
        }
      }
      // note cell for this dept
      if (noteIndex >= 0){
        er.notes = er.notes || new Array(7).fill('');
        er.notes[noteIndex] = (domRow.notes || [])[noteIndex] ?? '';
      }
      // remarks admin-only; base fields admin-only
    });
    return Array.from(existingMap.values());
  }

  async function saveSharedCsv(){
    if (!window.showSaveFilePicker && !pedCsvHandle){
      alert('Your browser does not support the File System Access API. Use Chrome or Edge.');
      return;
    }
    if (!pedCsvHandle){
      try{
        pedCsvHandle = await window.showSaveFilePicker({
          suggestedName:'ped-review-shared.csv',
          types:[{description:'CSV', accept:{'text/csv':['.csv']}}]
        });
        if (fileNameBadge) fileNameBadge.textContent = pedCsvHandle.name || 'Shared CSV';
      }catch(e){ return; }
    }
    try{
      let outputObjects = [];
      let hasExisting = false;
      try{
        const file = await pedCsvHandle.getFile();
        const text = await file.text();
        const existingRows = csvRowsToPEDObjects(parseCSV(text));
        if (existingRows.length){ hasExisting = true; }
        if (isAdmin || !hasExisting){
          outputObjects = [];
          document.querySelectorAll('#tbody-ped tr').forEach(tr=>{
            outputObjects.push(trToPedRow(tr));
          });
        } else {
          outputObjects = mergeNonAdminPED(existingRows);
        }
      }catch(e){
        // new file -> export all from DOM
        outputObjects = [];
        document.querySelectorAll('#tbody-ped tr').forEach(tr=>{
          outputObjects.push(trToPedRow(tr));
        });
      }
      const rows = pedObjectsToCsvRows(outputObjects);
      const writable = await pedCsvHandle.createWritable();
      await writable.write(toCSV(rows));
      await writable.close();
      alert('Shared CSV saved.');
    }catch(e){
      console.error(e);
      alert('Failed to save CSV.');
    }
  }

  // Wire buttons
  if (addPedBtn) addPedBtn.addEventListener('click', () => {
    if (!isAdmin) { alert('Only Admin can add rows.'); return; }
    const tbody = document.getElementById('tbody-ped');
    addPedRow(getNextItemNumberForTbody(tbody));
  });
  if (printBtnPed) printBtnPed.addEventListener('click', () => window.print());
  if (resetBtnPed) resetBtnPed.addEventListener('click', () => {
    if (!confirm('Reset all PED review cells to blank?')) return;
    document.querySelectorAll('#tbody-ped td.cycle').forEach(c => {
      if (c.dataset.locked === '1' && !isAdmin) return;
      c.textContent = ''; c.classList.remove('state-yes', 'state-no', 'state-na'); c.setAttribute('aria-pressed','false');
    });
  });
  if (exportCsvPedBtn) exportCsvPedBtn.addEventListener('click', () => {
    const table = document.getElementById('review-table-ped');
    let csv = [];
    for (let r=0;r<table.rows.length;r++){
      const row = table.rows[r];
      let cols = [];
      for (let c=0;c<row.cells.length;c++){
        cols.push(`"${row.cells[c].innerText.replace(/"/g,'""')}"`);
      }
      csv.push(cols.join(','));
    }
    const blob = new Blob(['\uFEFF'+csv.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ped-contract-review-checklist.csv'; a.click(); URL.revokeObjectURL(url);
  });
  if (exportTxtPedBtn) exportTxtPedBtn.addEventListener('click', () => {
    const table = document.getElementById('review-table-ped');
    const lines = [];
    for (let r=0;r<table.rows.length;r++){
      const row = table.rows[r];
      const cols = [];
      for (let c=0;c<row.cells.length;c++){
        const cell = row.cells[c];
        const btn = cell.querySelector('button');
        let txt = btn ? '' : cell.innerText;
        txt = txt.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
        cols.push(txt);
      }
      lines.push(cols.join('\t'));
    }
    const blob = new Blob([lines.join('\n')], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ped-contract-review-checklist.txt';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  });

  if (openSharedBtn) openSharedBtn.addEventListener('click', openSharedCsv);
  if (reloadSharedBtn) reloadSharedBtn.addEventListener('click', reloadSharedCsv);
  if (saveSharedBtn) saveSharedBtn.addEventListener('click', saveSharedCsv);

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    initPedRowDelegation();
    enforcePEDAccess();
    lockHeaderFields();
  });

  // Auto-fill
  (function(){
    const p = new URLSearchParams(window.location.search);
    const customer = p.get('customer'); const bid = p.get('bid'); const po = p.get('po'); const cr = p.get('cr');
    if (customer && document.getElementById('customerName')) document.getElementById('customerName').value = customer;
    if (document.getElementById('customerSelect')) {
      const sel = document.getElementById('customerSelect');
      if (customer) sel.value = customer;
    }
    if (bid && document.getElementById('bidDt')) document.getElementById('bidDt').value = bid;
    if (po && document.getElementById('poRevDt')) document.getElementById('poRevDt').value = po;
    if (cr && document.getElementById('crRevDt')) document.getElementById('crRevDt').value = cr;
  })();
})();