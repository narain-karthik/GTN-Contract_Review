// Contract Review — Admin full access; department-limited cycles; header + item fields admin-only
// + Shared CSV via File System Access API (Open / Reload / Save)
(function(){
  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');
  if (!dept) { window.location.href = 'login.html'; return; }

  // ---------- Department cycle ranges (62 total) ----------
  const CR_GROUPS = [
    {key:'engineering', count:9},
    {key:'manufacturing', count:8},
    {key:'materials', count:8},
    {key:'purchase', count:6},
    {key:'special-process', count:4},
    {key:'welding', count:3},
    {key:'assembly', count:4},
    {key:'quality', count:10},
    {key:'painting', count:5},
    {key:'customer-service', count:4},
    {key:'commercial', count:1}
  ];
  function allowedCycleIndexSet(currentDept, reviewColsCount){
    if (isAdmin) return null;
    let start = 0;
    for (const g of CR_GROUPS){
      const end = Math.min(start + g.count - 1, reviewColsCount - 1);
      if (g.key === currentDept) {
        const set = new Set();
        for (let i=start;i<=end;i++) set.add(i);
        return set;
      }
      start += g.count;
    }
    return new Set();
  }

  // ---------- UI references ----------
  const addBtn = document.getElementById('addItemBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');
  const exportCsvBtn = document.getElementById('exportCsv');
  const exportTxtBtn = document.getElementById('exportTxt');

  // New buttons for shared CSV
  const openSharedBtn = document.getElementById('openSharedCsv');   // Add this button in HTML
  const reloadSharedBtn = document.getElementById('reloadSharedCsv'); // Add this button in HTML
  const saveSharedBtn = document.getElementById('saveSharedCsv');   // Add this button in HTML
  const fileNameBadge = document.getElementById('sharedCsvName');   // Optional small span to show file name

  // ---------- Cycle logic ----------
  let reviewColsCount = 0;
  const DEFAULT_REVIEW_COLS = 62;
  const states = ['', '✓', 'x', 'NA'];

  function computeReviewColsCount() {
    const firstRow = document.querySelector('#tbody tr');
    if (firstRow) {
      const cycles = firstRow.querySelectorAll('td.cycle').length;
      if (cycles > 0) return cycles;
    }
    const lastHeadRow = document.querySelector('#review-table thead tr:last-child');
    if (lastHeadRow) {
      const ths = Array.from(lastHeadRow.querySelectorAll('th'));
      if (ths.length > 0) return ths.length;
    }
    return DEFAULT_REVIEW_COLS;
  }

  function initCycle(cell) {
    if (!cell || cell._cycleInit) return;
    cell._cycleInit = true;
    cell.addEventListener('click', () => {
      if (cell.dataset.locked === '1') return;
      const current = cell.textContent.trim();
      let idx = states.indexOf(current);
      if (idx === -1) idx = 0;
      const next = states[(idx + 1) % states.length];
      cell.textContent = next;
      cell.classList.remove('state-yes','state-no','state-na');
      if (next === '✓') cell.classList.add('state-yes');
      if (next === 'x') cell.classList.add('state-no');
      if (next === 'NA') cell.classList.add('state-na');
    });
    cell.tabIndex = 0;
    cell.addEventListener('keydown', (ev) => {
      if (cell.dataset.locked === '1') return;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cell.click(); }
    });
  }

  function normalizeExistingRows() {
    const rows = document.querySelectorAll('#tbody tr');
    rows.forEach(tr => {
      const cycles = tr.querySelectorAll('td.cycle').length;
      if (cycles < reviewColsCount) {
        const missing = reviewColsCount - cycles;
        const actionsTd = tr.querySelector('td.row-actions') || tr.lastElementChild;
        for (let i=0;i<missing;i++){
          const td = document.createElement('td');
          td.className = 'cycle';
          td.textContent = '';
          initCycle(td);
          tr.insertBefore(td, actionsTd);
        }
      } else if (cycles > reviewColsCount) {
        let extra = cycles - reviewColsCount;
        const cycleTds = Array.from(tr.querySelectorAll('td.cycle')).reverse();
        for (let i=0;i<extra && i<cycleTds.length;i++){
          cycleTds[i].remove();
        }
      }
    });
  }

  function initExisting() {
    document.querySelectorAll('.cycle').forEach(initCycle);
    document.querySelectorAll('.del-row').forEach(btn => {
      if (btn._delInit) return;
      btn._delInit = true;
      btn.addEventListener('click', () => {
        if (!isAdmin) { alert('Only Admin can delete rows.'); return; }
        const tr = btn.closest('tr');
        if (!tr) return;
        if (!confirm('Delete this row?')) return;
        tr.remove();
      });
    });
  }

  function getNextItemNumber() {
    const tbody = document.getElementById('tbody');
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

  function createCellEditable(classesList = '') {
    const td = document.createElement('td');
    td.contentEditable = isAdmin ? "true" : "false";
    td.className = 'editable bordered ' + classesList + (isAdmin ? '' : ' locked-edit');
    td.innerHTML = '';
    return td;
  }

  function createCycleCell() {
    const td = document.createElement('td');
    td.className = 'cycle';
    initCycle(td);
    return td;
  }

  function addRow(itemNo) {
    if (!reviewColsCount) reviewColsCount = computeReviewColsCount();
    const tbody = document.getElementById('tbody');
    const tr = document.createElement('tr');

    const tdItem = document.createElement('td');
    tdItem.className = 'fixed';
    tdItem.textContent = itemNo;
    tr.appendChild(tdItem);

    tr.appendChild(createCellEditable()); // Part #
    tr.appendChild(createCellEditable()); // Part Desc
    const rev = createCellEditable('small'); rev.classList.add('fixed'); tr.appendChild(rev);
    const qty = createCellEditable('small'); qty.classList.add('fixed'); tr.appendChild(qty);

    for (let i=0;i<reviewColsCount;i++){
      tr.appendChild(createCycleCell());
    }

    const remarks = document.createElement('td');
    remarks.contentEditable = isAdmin ? "true" : "false";
    remarks.className = 'editable bordered' + (isAdmin ? '' : ' locked-edit');
    tr.appendChild(remarks);

    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    const del = document.createElement('button');
    del.className = 'del-row';
    del.type = 'button';
    del.textContent = 'Delete';
    tdAct.appendChild(del);
    tr.appendChild(tdAct);

    document.getElementById('tbody').appendChild(tr);
    enforceCRAccess();
    tr.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  // ---------- Locks ----------
  function lockHeaderFields() {
    if (isAdmin) return;
    const ids = ['customerName', 'customerSelect', 'bidDt', 'poRevDt', 'crRevDt'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = true; el.classList.add('locked-edit'); }
    });
  }

  function enforceCRAccess(){
    const allowed = allowedCycleIndexSet(dept, reviewColsCount);
    document.querySelectorAll('#tbody tr').forEach(tr => {
      const cycles = Array.from(tr.querySelectorAll('td.cycle'));
      cycles.forEach((td, idx) => {
        const canEdit = isAdmin || (allowed && allowed.has(idx));
        if (canEdit) {
          td.dataset.locked = '0';
          td.style.pointerEvents = 'auto';
          td.style.opacity = '1';
          td.classList.remove('locked');
        } else {
          td.dataset.locked = '1';
          td.style.pointerEvents = 'none';
          td.style.opacity = '0.5';
          td.classList.add('locked');
        }
      });
      // Hard-lock base columns for non-admins
      if (!isAdmin) {
        const tds = Array.from(tr.children);
        for (let i=0;i<tds.length;i++){
          if (i<=4) { // [0]=ItemNo, [1]=Part#, [2]=PartDesc, [3]=Rev, [4]=Qty
            tds[i].contentEditable = "false";
            tds[i].classList.add('locked-edit');
          }
        }
      }
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
        } else {
          field += c;
        }
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

  // ---------- DOM <-> Data ----------
  function trToCRRow(tr){
    const tds = Array.from(tr.children);
    const key = (tds[0]?.innerText || '').trim();
    const part = (tds[1]?.innerText || '').trim();
    const desc = (tds[2]?.innerText || '').trim();
    const rev = (tds[3]?.innerText || '').trim();
    const qty = (tds[4]?.innerText || '').trim();
    const cycles = tds.slice(5, 5+reviewColsCount).map(td => td.innerText.trim());
    const remarks = (tds[5+reviewColsCount]?.innerText || '').trim();
    return { key, part, desc, rev, qty, cycles, remarks };
  }
  function buildCRMapFromDOM(){
    const map = new Map();
    document.querySelectorAll('#tbody tr').forEach(tr=>{
      const r = trToCRRow(tr);
      if (r.key) map.set(r.key, r);
    });
    return map;
  }
  function applyCRDataToDOM(dataRows){
    // dataRows: array of {key, part, desc, rev, qty, cycles[], remarks}
    const byKey = new Map(dataRows.map(r => [String(r.key), r]));
    document.querySelectorAll('#tbody tr').forEach(tr=>{
      const tds = Array.from(tr.children);
      const key = (tds[0]?.innerText || '').trim();
      if (!key || !byKey.has(key)) return;
      const r = byKey.get(key);
      // Base fields for display (locked visually for non-admin anyway)
      if (tds[1]) tds[1].innerText = r.part ?? '';
      if (tds[2]) tds[2].innerText = r.desc ?? '';
      if (tds[3]) tds[3].innerText = r.rev ?? '';
      if (tds[4]) tds[4].innerText = r.qty ?? '';
      // Cycles
      const cyclesTds = tds.slice(5, 5+reviewColsCount);
      cyclesTds.forEach((td, idx)=>{
        const val = (r.cycles || [])[idx] ?? '';
        td.innerText = val;
        td.classList.remove('state-yes','state-no','state-na');
        if (val === '✓') td.classList.add('state-yes');
        else if (val === 'x') td.classList.add('state-no');
        else if (val === 'NA') td.classList.add('state-na');
      });
      // Remarks
      const remarksTd = tds[5+reviewColsCount];
      if (remarksTd) remarksTd.innerText = r.remarks ?? '';
    });
  }

  // ---------- Shared CSV (FS Access API) ----------
  let crCsvHandle = null;

  async function openSharedCsv(){
    if (!window.showOpenFilePicker){ alert('Your browser does not support the File System Access API. Use Chrome or Edge.'); return; }
    try{
      const [handle] = await window.showOpenFilePicker({
        multiple:false,
        types:[{ description:'CSV', accept:{ 'text/csv':['.csv'] } }]
      });
      crCsvHandle = handle;
      if (fileNameBadge) fileNameBadge.textContent = handle.name || 'Shared CSV';
      await reloadSharedCsv();
    }catch(e){ /* canceled */ }
  }

  function makeCRHeader(){
    const header = ['ItemNo','PartNumber','PartDescription','Rev','Qty'];
    for (let i=1;i<=reviewColsCount;i++) header.push(`Cycle${i}`);
    header.push('Remarks');
    return header;
  }

  function csvRowsToCRObjects(rows){
    if (!rows || rows.length===0) return [];
    // detect header
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
    // cycles start next
    const cyclesStart = hasHeader ? (Math.max(idxItem, idxPart, idxDesc, idxRev, idxQty) + 1) : 5;
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
      // cycles up to reviewColsCount; remarks at the end
      const cycles = [];
      for (let i=0;i<reviewColsCount;i++){
        cycles.push((row[cyclesStart + i] ?? '').trim());
      }
      const remarks = (row[cyclesStart + reviewColsCount] ?? '').trim();
      rowsOut.push({ key, part, desc, rev, qty, cycles, remarks });
    }
    return rowsOut;
  }

  async function reloadSharedCsv(){
    if (!crCsvHandle){ await openSharedCsv(); return; }
    try{
      const file = await crCsvHandle.getFile();
      const text = await file.text();
      const rows = parseCSV(text);
      const objs = csvRowsToCRObjects(rows);
      applyCRDataToDOM(objs);
      enforceCRAccess();
      alert('Shared CSV reloaded.');
    }catch(e){
      console.error(e);
      alert('Failed to reload CSV.');
    }
  }

  function buildCRObjectsFromDOM(){
    const out = [];
    document.querySelectorAll('#tbody tr').forEach(tr=>{
      out.push(trToCRRow(tr));
    });
    return out;
  }

  function mergeNonAdminCR(existingRows){
    // existingRows: array of objects from CSV
    const existingMap = new Map(existingRows.map(r=>[String(r.key), r]));
    const domMap = buildCRMapFromDOM();
    const allowed = allowedCycleIndexSet(dept, reviewColsCount);
    existingMap.forEach((er, key) => {
      const domRow = domMap.get(key);
      if (!domRow) return;
      // merge only allowed cycles; keep er base fields and remarks
      if (allowed && allowed.size){
        er.cycles = er.cycles || [];
        for (let i=0;i<reviewColsCount;i++){
          if (allowed.has(i)){
            er.cycles[i] = (domRow.cycles || [])[i] ?? '';
          }
        }
      }
      // remarks are admin-only; do not change for non-admin
    });
    return Array.from(existingMap.values());
  }

  function crObjectsToCsvRows(objs){
    const header = makeCRHeader();
    const rows = [header];
    objs.forEach(r=>{
      const row = [r.key, r.part, r.desc, r.rev, r.qty, ...(r.cycles || [])];
      row.push(r.remarks ?? '');
      rows.push(row);
    });
    return rows;
  }

  async function saveSharedCsv(){
    if (!window.showSaveFilePicker && !crCsvHandle){
      alert('Your browser does not support the File System Access API. Use Chrome or Edge.');
      return;
    }
    // Ensure handle
    if (!crCsvHandle){
      try{
        crCsvHandle = await window.showSaveFilePicker({
          suggestedName:'contract-review-shared.csv',
          types:[{description:'CSV', accept:{'text/csv':['.csv']}}]
        });
        if (fileNameBadge) fileNameBadge.textContent = crCsvHandle.name || 'Shared CSV';
      }catch(e){ return; }
    }

    reviewColsCount = computeReviewColsCount();

    try{
      let outputObjects = [];
      // If file exists, read then merge (so we keep columns/rows we don't control)
      let hasExisting = false;
      try{
        const file = await crCsvHandle.getFile();
        const text = await file.text();
        const existingRows = csvRowsToCRObjects(parseCSV(text));
        if (existingRows.length){ hasExisting = true; }
        if (isAdmin || !hasExisting){
          // Admin writes whole DOM; or if file empty, base from DOM
          outputObjects = buildCRObjectsFromDOM();
        } else {
          // Non-admin merge only allowed cycles into existingRows
          outputObjects = mergeNonAdminCR(existingRows);
        }
      }catch(e){
        // first save (new file)
        outputObjects = buildCRObjectsFromDOM();
      }

      const rows = crObjectsToCsvRows(outputObjects);
      const writable = await crCsvHandle.createWritable();
      await writable.write(toCSV(rows));
      await writable.close();
      alert('Shared CSV saved.');
    }catch(e){
      console.error(e);
      alert('Failed to save CSV.');
    }
  }

  // ---------- Wire buttons ----------
  if (addBtn) addBtn.addEventListener('click', () => {
    if (!isAdmin) { alert('Only Admin can add rows.'); return; }
    addRow(getNextItemNumber());
  });
  if (printBtn) printBtn.addEventListener('click', () => window.print());
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all review cells to blank?')) return;
    document.querySelectorAll('.cycle').forEach(c => {
      if (c.dataset.locked === '1' && !isAdmin) return;
      c.textContent = '';
      c.classList.remove('state-yes','state-no','state-na');
    });
  });
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {
    const table = document.getElementById('review-table');
    let csv = [];
    for (let r=0;r<table.rows.length;r++){
      const row = table.rows[r];
      let cols = [];
      for (let c=0;c<row.cells.length;c++){
        const cell = row.cells[c];
        const btn = cell.querySelector('button');
        let txt = btn ? '' : cell.innerText.trim();
        txt = '"' + txt.replace(/"/g,'""') + '"';
        cols.push(txt);
      }
      csv.push(cols.join(','));
    }
    const blob = new Blob([csv.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contract-review-checklist.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  if (exportTxtBtn) exportTxtBtn.addEventListener('click', () => {
    const table = document.getElementById('review-table');
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
    a.download = 'contract-review-checklist.txt';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  });

  if (openSharedBtn) openSharedBtn.addEventListener('click', openSharedCsv);
  if (reloadSharedBtn) reloadSharedBtn.addEventListener('click', reloadSharedCsv);
  if (saveSharedBtn) saveSharedBtn.addEventListener('click', saveSharedCsv);

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    reviewColsCount = computeReviewColsCount();
    normalizeExistingRows();
    initExisting();
    enforceCRAccess();
    lockHeaderFields();
    // Non-admin can save only allowed cycles; Admin can save all. Button remains visible for both.
  });

  // Auto-fill common fields from URL
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