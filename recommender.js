/*  NAV HIGHLIGHT  */
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('nav a');

function highlightNav() {
  let current = '';
  sections.forEach(sec => {
    if (sec.getBoundingClientRect().top <= 120) current = sec.id;
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}

window.addEventListener('scroll', highlightNav, { passive: true });
highlightNav();

/*  RECOMMENDER  */
(function () {
  const searchInput = document.getElementById('rec-search');
  const dropdown = document.getElementById('rec-dropdown');
  const selectedDiv = document.getElementById('rec-selected');
  const goBtn = document.getElementById('rec-go');
  const statusDiv = document.getElementById('rec-status');
  const resultsDiv = document.getElementById('rec-results');

  let fragrances = [];   // [{name, brand, label}]  label = "x Name by y Brand"
  let selected = [];     // indices into fragrances[]
  let pyodide = null;
  let pyReady = false;

  // Load fragrance list from CSV 
  fetch('fra_cleaned.csv')
    .then(r => r.text())
    .then(text => {
      const lines = text.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');
        if (parts.length < 3) continue;
        const name = parts[1].trim();
        const brand = parts[2].trim();
        if (name) fragrances.push({ name, brand, label: name + ' by ' + brand, idx: i - 1 });
      }
      statusDiv.textContent = fragrances.length + ' fragrances loaded. Pyodide loading...';
      loadPyodide();
    });

  //  Autocomplete dropdown 
  searchInput.addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    dropdown.innerHTML = '';
    if (q.length < 2) { dropdown.style.display = 'none'; return; }

    const matches = fragrances.filter(f => f.label.toLowerCase().includes(q)).slice(0, 20);
    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    matches.forEach(f => {
      const div = document.createElement('div');
      div.textContent = f.label;
      div.addEventListener('mousedown', () => addSelection(f));
      dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => dropdown.style.display = 'none', 150);
  });

  function addSelection(f) {
    if (selected.length >= 1) return;
    if (selected.find(s => s.idx === f.idx)) return;
    selected.push(f);
    searchInput.value = '';
    dropdown.style.display = 'none';
    renderSelected();
  }

  function renderSelected() {
    selectedDiv.innerHTML = '';
    selected.forEach((f, i) => {
      const span = document.createElement('span');
      span.className = 'rec-tag';
      span.textContent = f.label;
      const x = document.createElement('button');
      x.textContent = '\u00d7';
      x.addEventListener('click', () => { selected.splice(i, 1); renderSelected(); });
      span.appendChild(x);
      selectedDiv.appendChild(span);
    });
    goBtn.disabled = selected.length === 0 || !pyReady;
  }

  //  Load Pyodide + numpy 
  async function loadPyodide() {
    pyodide = await globalThis.loadPyodide();
    await pyodide.loadPackage('numpy');
    pyReady = true;
    statusDiv.textContent = 'Ready.';
    goBtn.disabled = selected.length === 0;
  }

  //  Run recommendation 
  goBtn.addEventListener('click', async function () {
    if (!pyReady || selected.length === 0) return;
    goBtn.disabled = true;
    statusDiv.textContent = 'Computing...';
    resultsDiv.innerHTML = '';

    // Fetch CSV and NMF data and pass to Python
    const [csvText, nmfData] = await Promise.all([
      fetch('fra_cleaned.csv').then(r => r.text()),
      fetch('nmf_w.json').then(r => r.json()),
    ]);

    const indices = selected.map(s => s.idx);

    pyodide.globals.set('csv_text', csvText);
    pyodide.globals.set('nmf_w_json', JSON.stringify(nmfData));
    pyodide.globals.set('blend_indices_js', JSON.stringify(indices));

    const result = await pyodide.runPythonAsync(`
import numpy as np
from numpy.linalg import norm
import json

def _run(csv_text, blend_indices_js, nmf_w_json):
    lines = csv_text.strip().split('\\n')
    rows = []
    for line in lines[1:]:
        parts = line.split(';')
        if len(parts) < 6:
            continue
        name = parts[1].strip()
        brand = parts[2].strip()
        all_notes = []
        for col_val in parts[3:6]:
            if col_val.strip():
                for n in col_val.split(','):
                    all_notes.append(n.strip().lower())
        rows.append({'name': name, 'brand': brand, 'notes': all_notes})

    unique_notes = set()
    for r in rows:
        unique_notes.update(r['notes'])
    sorted_notes = sorted(unique_notes)
    note_to_idx = {n: i for i, n in enumerate(sorted_notes)}
    n_frags = len(rows)
    n_notes = len(sorted_notes)

    note_matrix = np.zeros((n_frags, n_notes), dtype=np.float64)
    for ri, r in enumerate(rows):
        for note in r['notes']:
            note_matrix[ri, note_to_idx[note]] = 1.0

    N = n_frags
    df_t = note_matrix.sum(axis=0)
    idf = np.log(N / df_t)
    tfidf = note_matrix * idf

    blend_indices = json.loads(blend_indices_js)
    target_vec = tfidf[blend_indices[0]]
    blended_norm = norm(target_vec)

    norms = np.linalg.norm(tfidf, axis=1)
    dots = tfidf @ target_vec
    denom = norms * blended_norm
    scores = np.where(denom > 0, dots / denom, 0.0)

    for bi in blend_indices:
        scores[bi] = 0.0

    top10 = scores.argsort()[-10:][::-1]

    nmf_data = json.loads(nmf_w_json)
    W = np.array(nmf_data['W'])
    labels = nmf_data['labels']

    archetype_scores = W[blend_indices[0]]
    total = archetype_scores.sum()
    if total > 0:
        archetype_pct = (archetype_scores / total * 100).tolist()
    else:
        archetype_pct = [25.0] * len(labels)

    recs = []
    for idx in top10:
        idx = int(idx)
        recs.append({
            'name': rows[idx]['name'],
            'brand': rows[idx]['brand'],
            'score': round(float(scores[idx]), 3),
        })

    return json.dumps({
        'recommendations': recs,
        'archetype_labels': labels,
        'archetype_pct': [round(p, 1) for p in archetype_pct],
    })

_run(csv_text, blend_indices_js, nmf_w_json)
`);

    const data = JSON.parse(result);
    renderResults(data);
    statusDiv.textContent = 'Done.';
    goBtn.disabled = false;
  });

  function renderResults(data) {
    let html = '<div class="card"><div class="card-title">Top 10 Recommendations</div><ol>';
    data.recommendations.forEach(r => {
      html += '<li><strong>' + r.name + '</strong> by ' + r.brand + '</li>';
    });
    html += '</ol></div>';

    html += '<div class="card"><div class="card-title">Your FragranceDNA</div><ol id="rec-dna">';
    const ranked = data.archetype_labels
      .map((label, i) => ({ label, pct: data.archetype_pct[i] }))
      .filter(d => d.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    ranked.forEach(d => {
      html += '<li><strong>' + d.label + '</strong> <span style="color:var(--text-3)">' + d.pct + '%</span></li>';
    });
    html += '</ol></div>';

    resultsDiv.innerHTML = html;
  }
})();
