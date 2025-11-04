// Lead Time — Admin editable; others read-only; Export .txt (tab-separated)
(function(){
  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');
  if (!dept) { window.location.href = 'login.html'; }

  document.addEventListener('DOMContentLoaded', () => {
    if (!isAdmin) {
      document.querySelectorAll('input, select, button').forEach(el => {
        if (el.id === 'printBtn' || el.id === 'exportCsv' || el.id === 'exportTxt') return;
        if (el.type === 'button' && (el.id === 'addItemBtn' || el.id === 'resetBtn')) {
          el.disabled = true; el.style.opacity = '0.5';
        } else {
          el.disabled = true;
        }
      });
    }
  });

  function formatDisplay(date) {
    if (!date) return '00-Jan-00';
    if (!(date instanceof Date) || isNaN(date)) return '00-Jan-00';
    const d = date.getDate().toString().padStart(2,'0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[date.getMonth()];
    const yy = String(date.getFullYear()).slice(-2);
    return `${d}-${m}-${yy}`;
  }
  function parseISO(value){ if (!value) return null; const dt = new Date(value); return isNaN(dt) ? null : dt; }
  function calcAgreed(custIso, leadDays) {
    const cust = parseISO(custIso);
    if (!cust || isNaN(Number(leadDays))) return null;
    const ag = new Date(cust.getTime());
    ag.setDate(ag.getDate() - Number(leadDays));
    return ag;
  }

  function wireRow(row) {
    if (row._wired) return;
    row._wired = true;

    const custInput = row.querySelector('.cust-date');
    const gtnInput = row.querySelector('.gtn-date');
    const leadInput = row.querySelector('.lead-days');

    const dt = row.querySelectorAll('.date-cell .date-text');
    const custDisplay = dt[0];
    const gtnDisplay = dt[1] || dt[0];

    function updateDisplays() {
      const custVal = parseISO(custInput.value);
      const gtnVal = parseISO(gtnInput.value);
      custDisplay.textContent = formatDisplay(custVal);
      custDisplay.classList.toggle('empty', !custVal);
      gtnDisplay.textContent = formatDisplay(gtnVal);
      gtnDisplay.classList.toggle('empty', !gtnVal);
    }

    updateDisplays();

    function recalcAndSet(autoSet=true) {
      const custVal = custInput.value;
      const leadVal = leadInput.value;
      const ag = calcAgreed(custVal, leadVal);
      if (ag && autoSet) {
        gtnInput.value = ag.toISOString().slice(0,10);
      }
      updateDisplays();
    }

    if (custInput) {
      custInput.addEventListener('change', () => recalcAndSet(true));
      const custDisplayEl = custInput.parentElement.querySelector('.date-text');
      if (custDisplayEl) custDisplayEl.addEventListener('click', () => custInput.showPicker && custInput.showPicker());
    }
    if (gtnInput) {
      const gtnDisplayEl = gtnInput.parentElement.querySelector('.date-text');
      if (gtnDisplayEl) gtnDisplayEl.addEventListener('click', () => gtnInput.showPicker && gtnInput.showPicker());
      gtnInput.addEventListener('change', updateDisplays);
    }
    if (leadInput) leadInput.addEventListener('input', () => recalcAndSet(true));

    const del = row.querySelector('.del-row');
    if (del) {
      del.addEventListener('click', () => {
        if (!isAdmin) { alert('Only Admin can delete rows.'); return; }
        if (!confirm('Delete this row?')) return;
        row.remove();
      });
    }
  }

  function initExisting() { document.querySelectorAll('#tbody tr').forEach(wireRow); }

  function getNextItemNumber(){
    const rows = Array.from(document.querySelectorAll('#tbody tr'));
    if (rows.length === 0) return 10;
    let max = 0;
    rows.forEach(r=>{
      const td = r.querySelector('td.fixed');
      if (!td) return;
      const v = parseInt(td.textContent.trim());
      if (!isNaN(v) && v > max) max = v;
    });
    return (max === 0) ? 10 : max + 10;
  }

  function createCellInput(cls, attrs = {}) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.className = cls;
    for (const k in attrs) inp.setAttribute(k, attrs[k]);
    if (!isAdmin) inp.disabled = true;
    td.appendChild(inp);
    return td;
  }

  function createDateCell(cls) {
    const td = document.createElement('td');
    td.className = 'date-cell';
    const input = document.createElement('input');
    input.className = cls + ' cell-date';
    input.type = 'date';
    input.disabled = !isAdmin;
    const span = document.createElement('div');
    span.className = 'date-text';
    span.textContent = '00-Jan-00';
    td.appendChild(input);
    td.appendChild(span);
    return td;
  }

  function addRow(itemNo) {
    if (!isAdmin) { alert('Only Admin can add rows.'); return; }
    const tbody = document.getElementById('tbody');
    const tr = document.createElement('tr');

    const tdItem = document.createElement('td');
    tdItem.className = 'fixed';
    tdItem.textContent = itemNo;
    tr.appendChild(tdItem);

    tr.appendChild(createCellInput('cell-input part'));
    tr.appendChild(createCellInput('cell-input desc'));
    tr.appendChild(createCellInput('cell-input rev'));
    tr.appendChild(createCellInput('cell-input qty', {type:'number', min:0}));

    tr.appendChild(createDateCell('cust-date'));
    tr.appendChild(createCellInput('cell-input lead-days', {type:'number', min:0, placeholder:'0'}));
    tr.appendChild(createDateCell('gtn-date'));

    tr.appendChild(createCellInput('cell-input remarks'));
    const act = document.createElement('td');
    act.className = 'row-actions';
    const del = document.createElement('button'); del.className = 'del-row'; del.type = 'button'; del.textContent = 'Delete';
    act.appendChild(del);
    tr.appendChild(act);

    tbody.appendChild(tr);
    wireRow(tr);
    tr.scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  function exportCSV(){
    const table = document.getElementById('lead-table');
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(r=>{
      const cols = Array.from(r.cells).map(cell=>{
        const dateText = cell.querySelector('.date-text');
        const inp = cell.querySelector('input');
        if (dateText) return `"${dateText.textContent.trim().replace(/"/g,'""')}"`;
        else if (inp) return `"${String(inp.value || '').replace(/"/g,'""')}"`;
        else return `"${String(cell.textContent || '').replace(/"/g,'""')}"`;
      });
      return cols.join(',');
    });
    const blob = new Blob([csv.join('\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lead-time-sheet.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // Export TXT (tab-separated), uses displayed formatted dates
  function exportTXT(){
    const table = document.getElementById('lead-table');
    const rows = Array.from(table.querySelectorAll('tr'));
    const lines = rows.map(r=>{
      const cols = Array.from(r.cells).map(cell=>{
        const dateText = cell.querySelector('.date-text');
        const btn = cell.querySelector('button');
        let txt;
        if (btn) txt = '';
        else if (dateText) txt = dateText.textContent.trim();
        else txt = cell.innerText.trim();
        return txt.replace(/\t/g,' ').replace(/\r?\n/g,' ');
      });
      return cols.join('\t');
    });
    const blob = new Blob([lines.join('\n')], {type:'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lead-time-sheet.txt'; a.click(); URL.revokeObjectURL(a.href);
  }

  document.getElementById('addItemBtn')?.addEventListener('click', ()=> addRow( getNextItemNumber() ));
  document.getElementById('printBtn')?.addEventListener('click', ()=> window.print());
  document.getElementById('exportCsv')?.addEventListener('click', exportCSV);
  document.getElementById('exportTxt')?.addEventListener('click', exportTXT);
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (!isAdmin) { alert('Only Admin can reset values.'); return; }
    if(!confirm('Clear all input values in the table?')) return;
    document.querySelectorAll('#tbody tr').forEach(tr=>{
      tr.querySelectorAll('input').forEach(inp => { inp.value = ''; });
      tr.querySelectorAll('.date-text').forEach(dt => { dt.textContent = '00-Jan-00'; dt.classList.add('empty'); });
    });
  });
  document.addEventListener('DOMContentLoaded', initExisting);

  (function(){
    const p = new URLSearchParams(window.location.search);
    const customer = p.get('customer'); const bid = p.get('bid'); const po = p.get('po'); const cr = p.get('cr');
    if (customer && document.getElementById('customerSelect')) document.getElementById('customerSelect').value = customer;
    if (document.getElementById('customerName')) {
      const sel = document.getElementById('customerName');
      if (customer) sel.value = customer;
    }
    if (bid && document.getElementById('bidDt')) document.getElementById('bidDt').value = bid;
    if (po && document.getElementById('poRevDt')) document.getElementById('poRevDt').value = po;
    if (cr && document.getElementById('crRevDt')) document.getElementById('crRevDt').value = cr;
  })();
})();