/* Client-side spreadsheet demo.
   A small demonstration of the "drag in a spreadsheet, get instant analysis" approach.
   Files are read in the browser and are never uploaded. CSV is parsed here; .xlsx and .xls
   are parsed with SheetJS, which is loaded from cdnjs only when one of those files is chosen.
   The pure functions below are exported so they can be unit-tested in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.ExcelDemo = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_ROWS = 20000;
  var PREVIEW_ROWS = 8;
  var MAX_GROUPS = 12;
  var SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  /* ---------- Parsing ---------- */

  function detectDelimiter(text) {
    var first = text.split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; })[0] || '';
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQuotes = false;
    for (var i = 0; i < first.length; i++) {
      var c = first.charAt(i);
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && counts.hasOwnProperty(c)) counts[c]++;
    }
    var best = ',';
    Object.keys(counts).forEach(function (k) { if (counts[k] > counts[best]) best = k; });
    return best;
  }

  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    var delimiter = detectDelimiter(text);
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"' && field === '') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }

  function normalizeCell(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    if (typeof v === 'number') return isFinite(v) ? v : '';
    return String(v);
  }

  /* rows: array of arrays. First row is the header. */
  function toTable(rows) {
    if (!rows || !rows.length) return { headers: [], body: [], truncated: false };
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var seen = {};
    var headers = [];
    for (var i = 0; i < width; i++) {
      var name = String(rows[0][i] === undefined ? '' : rows[0][i]).trim() || ('Column ' + (i + 1));
      if (seen[name]) { seen[name]++; name = name + ' (' + seen[name] + ')'; } else { seen[name] = 1; }
      headers.push(name);
    }
    var body = rows.slice(1, MAX_ROWS + 1).map(function (r) {
      var out = [];
      for (var j = 0; j < width; j++) out.push(r[j] === undefined ? '' : r[j]);
      return out;
    });
    return { headers: headers, body: body, truncated: rows.length - 1 > MAX_ROWS };
  }

  var THOUSANDS = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/;
  var PLAIN = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v).trim().replace(/\s/g, '');
    if (s === '') return NaN;
    if (s.charAt(s.length - 1) === '%') s = s.slice(0, -1);
    if (THOUSANDS.test(s)) s = s.replace(/,/g, '');
    return PLAIN.test(s) ? Number(s) : NaN;
  }

  function isFilled(v) { return !(v === '' || v === null || v === undefined || String(v).trim() === ''); }

  /* ---------- Analysis ---------- */

  function profile(table) {
    var columns = table.headers.map(function (name, idx) {
      var filled = 0, numeric = 0, sum = 0, min = Infinity, max = -Infinity, seen = {}, unique = 0;
      table.body.forEach(function (row) {
        var v = row[idx];
        if (!isFilled(v)) return;
        filled++;
        var n = toNumber(v);
        if (!isNaN(n)) { numeric++; sum += n; if (n < min) min = n; if (n > max) max = n; }
        var key = String(v).trim();
        if (!seen.hasOwnProperty(key)) { seen[key] = true; unique++; }
      });
      var isNumber = filled > 0 && numeric / filled >= 0.9;
      return {
        index: idx, name: name, type: isNumber ? 'Number' : 'Text', filled: filled, unique: unique,
        min: isNumber ? min : null, max: isNumber ? max : null, mean: isNumber && numeric ? sum / numeric : null
      };
    });
    var totalCells = table.body.length * table.headers.length;
    var filledCells = columns.reduce(function (s, c) { return s + c.filled; }, 0);
    return {
      columns: columns, rowCount: table.body.length, colCount: table.headers.length,
      totalCells: totalCells, emptyCells: totalCells - filledCells
    };
  }

  function groupableColumns(prof) {
    return prof.columns.filter(function (c) { return c.type === 'Text' && c.unique >= 2 && c.unique <= MAX_GROUPS; });
  }
  function numericColumns(prof) {
    return prof.columns.filter(function (c) { return c.type === 'Number'; });
  }

  function groupAverages(table, measureIdx, groupIdx) {
    var map = {}, order = [];
    table.body.forEach(function (row) {
      if (!isFilled(row[groupIdx])) return;
      var n = toNumber(row[measureIdx]);
      if (isNaN(n)) return;
      var key = String(row[groupIdx]).trim();
      if (!map.hasOwnProperty(key)) { map[key] = { label: key, sum: 0, count: 0 }; order.push(key); }
      map[key].sum += n; map[key].count++;
    });
    return order.map(function (k) { return { label: map[k].label, avg: map[k].sum / map[k].count, count: map[k].count }; })
      .sort(function (a, b) { return b.avg - a.avg; });
  }

  /* ---------- Sample data (fictional) ---------- */

  function sampleCSV() {
    var seed = 20260;
    function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var lines = ['Site,Team,Week,Tickets resolved,Quality score,Attendance'];
    ['Site A', 'Site B'].forEach(function (site, s) {
      ['Team 1', 'Team 2', 'Team 3'].forEach(function (team, t) {
        for (var w = 1; w <= 4; w++) {
          var tickets = Math.round(380 + rand() * 180 + s * 25 - t * 18);
          var quality = (88 + rand() * 9 + (s ? 0.8 : 0)).toFixed(1);
          var attendance = (91 + rand() * 7).toFixed(1);
          lines.push([site, team, 'Week ' + w, tickets, quality, attendance].join(','));
        }
      });
    });
    return lines.join('\n');
  }

  /* ---------- Formatting ---------- */

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /* ---------- Browser UI ---------- */

  function init() {
    var input = document.getElementById('demo-file');
    if (!input) return;

    var zone = document.getElementById('demo-dropzone');
    var sampleButton = document.getElementById('demo-sample');
    var statusEl = document.getElementById('demo-status');
    var errorEl = document.getElementById('demo-error');
    var results = document.getElementById('demo-results');
    var state = { table: null, prof: null };
    var sheetPromise = null;

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    function setStatus(msg) { errorEl.textContent = ''; statusEl.textContent = msg; }
    function setError(msg) { statusEl.textContent = ''; errorEl.textContent = 'Couldn\u2019t read that file. ' + msg; results.hidden = true; }

    function loadSheetJS() {
      if (window.XLSX) return Promise.resolve(window.XLSX);
      if (sheetPromise) return sheetPromise;
      sheetPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SHEETJS_URL;
        s.async = true;
        s.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('missing')); };
        s.onerror = function () { sheetPromise = null; reject(new Error('load')); };
        document.head.appendChild(s);
      });
      return sheetPromise;
    }

    function finish(rows, label) {
      var table = toTable(rows);
      if (!table.headers.length) { setError('No rows were found. Check that the first row holds column names.'); return; }
      if (!table.body.length) { setError('The file has column names but no data rows.'); return; }
      state.table = table;
      state.prof = profile(table);
      render(label);
      var msg = 'Loaded ' + label + ': ' + fmt(state.prof.rowCount) + ' rows, ' + state.prof.colCount + ' columns.';
      if (table.truncated) msg += ' Only the first ' + fmt(MAX_ROWS) + ' rows were analysed.';
      setStatus(msg);
    }

    function handleFile(file) {
      var name = file.name || 'file';
      var ext = (name.split('.').pop() || '').toLowerCase();
      if (['csv', 'xlsx', 'xls'].indexOf(ext) === -1) {
        setError('\u201c' + name + '\u201d isn\u2019t a supported type. Choose a .xlsx, .xls or .csv file.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('\u201c' + name + '\u201d is ' + (file.size / 1048576).toFixed(1) + ' MB. The demo reads files up to 5 MB.');
        return;
      }
      setStatus('Reading ' + name + '\u2026');
      if (ext === 'csv') {
        file.text().then(function (text) { finish(parseCSV(text), name); },
          function () { setError('The browser couldn\u2019t open it. Try saving it again.'); });
        return;
      }
      loadSheetJS().then(function (X) {
        return file.arrayBuffer().then(function (buffer) {
          var wb = X.read(buffer, { type: 'array', cellDates: true });
          var sheetName = wb.SheetNames[0];
          if (!sheetName) throw new Error('empty');
          var aoa = X.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true });
          var label = name + (wb.SheetNames.length > 1 ? ' (first sheet: ' + sheetName + ')' : '');
          finish(aoa.map(function (r) { return r.map(normalizeCell); }), label);
        });
      }).catch(function (err) {
        if (err && err.message === 'load') setError('The Excel reader couldn\u2019t be loaded. Check your connection and try again, or use a .csv file.');
        else setError('The workbook couldn\u2019t be parsed. It may be damaged or password-protected.');
      });
    }

    function render(label) {
      var prof = state.prof;
      clear(results);
      results.hidden = false;

      // Summary
      var stats = el('dl', 'stats');
      [['Rows', fmt(prof.rowCount)], ['Columns', String(prof.colCount)],
       ['Empty cells', prof.totalCells ? Math.round(prof.emptyCells / prof.totalCells * 100) + '%' : '0%']].forEach(function (p) {
        var d = el('div'); d.appendChild(el('dt', null, p[0])); d.appendChild(el('dd', null, p[1])); stats.appendChild(d);
      });
      results.appendChild(stats);

      // Chart block
      var chartBlock = el('div');
      chartBlock.appendChild(el('h4', null, 'Average by group'));
      var nums = numericColumns(prof), groups = groupableColumns(prof);
      if (!nums.length || !groups.length) {
        chartBlock.appendChild(el('p', 'chart-note',
          !nums.length ? 'There are no numeric columns, so there is nothing to average. The column summary below still applies.'
                       : 'A chart needs a text column with 2 to ' + MAX_GROUPS + ' distinct values to group by. None was found, so the column summary below is the result.'));
      } else {
        var controls = el('div', 'chart-controls');
        var measure = makeSelect('demo-measure', 'Measure', nums);
        var group = makeSelect('demo-group', 'Group by', groups);
        controls.appendChild(measure.field); controls.appendChild(group.field);
        chartBlock.appendChild(controls);
        var list = el('ol', 'bars');
        list.id = 'demo-bars';
        chartBlock.appendChild(list);
        var note = el('p', 'chart-note');
        chartBlock.appendChild(note);
        var draw = function () { drawBars(list, note, Number(measure.select.value), Number(group.select.value)); };
        measure.select.addEventListener('change', draw);
        group.select.addEventListener('change', draw);
        draw();
      }
      results.appendChild(chartBlock);

      // Column summary
      var colBlock = el('div');
      colBlock.appendChild(el('h4', null, 'Columns'));
      colBlock.appendChild(buildTable('Column summary', ['Column', 'Type', 'Filled', 'Details'],
        prof.columns.map(function (c) {
          return [c.name, c.type, fmt(c.filled) + ' of ' + fmt(prof.rowCount),
            c.type === 'Number' ? 'Min ' + fmt(c.min) + ', max ' + fmt(c.max) + ', mean ' + fmt(c.mean) : fmt(c.unique) + ' distinct values'];
        }), []));
      results.appendChild(colBlock);

      // Preview
      var preview = el('div');
      preview.appendChild(el('h4', null, 'First ' + Math.min(PREVIEW_ROWS, prof.rowCount) + ' rows'));
      var numericIdx = {};
      numericColumns(prof).forEach(function (c) { numericIdx[c.index] = true; });
      preview.appendChild(buildTable('Data preview', state.table.headers,
        state.table.body.slice(0, PREVIEW_ROWS).map(function (r) {
          return r.map(function (v, i) { return numericIdx[i] && !isNaN(toNumber(v)) ? fmt(toNumber(v)) : String(v); });
        }), Object.keys(numericIdx).map(Number)));
      results.appendChild(preview);
    }

    function makeSelect(id, labelText, cols) {
      var field = el('div', 'field');
      var label = el('label', null, labelText); label.htmlFor = id;
      var select = el('select'); select.id = id;
      cols.forEach(function (c) { var o = el('option', null, c.name); o.value = String(c.index); select.appendChild(o); });
      field.appendChild(label); field.appendChild(select);
      return { field: field, select: select };
    }

    function drawBars(list, note, measureIdx, groupIdx) {
      clear(list);
      var data = groupAverages(state.table, measureIdx, groupIdx);
      var max = data.reduce(function (m, d) { return Math.max(m, d.avg); }, 0);
      var fills = [];
      data.forEach(function (d) {
        var li = el('li');
        li.appendChild(el('span', 'bars__label', d.label));
        var track = el('span', 'bars__track'); track.setAttribute('aria-hidden', 'true');
        var fill = el('span', 'bars__fill'); track.appendChild(fill); li.appendChild(track);
        li.appendChild(el('span', 'bars__value', fmt(d.avg)));
        list.appendChild(li);
        fills.push([fill, max > 0 ? Math.max(0, d.avg) / max * 100 : 0]);
      });
      // Set widths on the next frame so the bars grow from zero in response to the user's choice.
      requestAnimationFrame(function () { fills.forEach(function (f) { f[0].style.width = f[1] + '%'; }); });
      note.textContent = 'Bars start at zero. Each value is the mean of ' + state.prof.columns[measureIdx].name +
        ' for rows in that ' + state.prof.columns[groupIdx].name + '.';
    }

    function buildTable(captionText, heads, rows, numericCols) {
      var wrap = el('div', 'table-wrap');
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', captionText + ' (scrollable)');
      var table = el('table', 'data-table');
      table.appendChild(el('caption', 'visually-hidden', captionText));
      var thead = el('thead'), htr = el('tr');
      heads.forEach(function (h, i) {
        var th = el('th', numericCols.indexOf(i) > -1 ? 'num' : null, h); th.scope = 'col'; htr.appendChild(th);
      });
      thead.appendChild(htr); table.appendChild(thead);
      var tbody = el('tbody');
      rows.forEach(function (r) {
        var tr = el('tr');
        r.forEach(function (v, i) { tr.appendChild(el('td', numericCols.indexOf(i) > -1 ? 'num' : null, v)); });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table);
      return wrap;
    }

    /* Events */
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
      input.value = '';
    });

    sampleButton.addEventListener('click', function () {
      finish(parseCSV(sampleCSV()), 'sample data (fictional)');
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.add('is-dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      zone.addEventListener(type, function (e) { e.preventDefault(); zone.classList.remove('is-dragover'); });
    });
    zone.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFile(files[0]);
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return {
    parseCSV: parseCSV, toTable: toTable, toNumber: toNumber, profile: profile,
    groupAverages: groupAverages, groupableColumns: groupableColumns, numericColumns: numericColumns,
    sampleCSV: sampleCSV, normalizeCell: normalizeCell, MAX_ROWS: MAX_ROWS
  };
}));
