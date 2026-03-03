/* ── NAV HIGHLIGHT ─────────────────────────────────── */
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

/* ── PILL SELECTION ────────────────────────────────── */
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const g = pill.dataset.g;
    document.querySelectorAll(`.pill[data-g="${g}"]`).forEach(p => p.classList.remove('sel'));
    pill.classList.add('sel');
  });
});

/* ── INTENSITY SLIDER ──────────────────────────────── */
const slider = document.getElementById('intensity');
const intVal = document.getElementById('int-val');
slider.addEventListener('input', () => { intVal.textContent = slider.value + ' / 5'; });

/* ── RECOMMENDER ───────────────────────────────────── */
const DB = [
  { house: 'Acqua di Parma',    name: 'Colonia',                    notes: ['Citrus', 'Lavender', 'Sandalwood'],  match: 94 },
  { house: 'Diptyque',          name: 'Philosykos',                 notes: ['Fig Leaf', 'Wood', 'Milk'],          match: 91 },
  { house: 'Le Labo',           name: 'Santal 33',                  notes: ['Sandalwood', 'Cedar', 'Iris'],       match: 88 },
  { house: 'Maison Margiela',   name: 'Replica: By the Fireplace',  notes: ['Chestnut', 'Cashmeran', 'Guaiac'],  match: 93 },
  { house: 'Byredo',            name: "Bal d'Afrique",              notes: ['Marigold', 'Violet', 'Musk'],       match: 87 },
  { house: 'Serge Lutens',      name: 'Fille en Aiguilles',         notes: ['Pine', 'Frankincense', 'Honey'],    match: 85 },
  { house: 'Chanel',            name: 'Chance Eau Tendre',          notes: ['Grapefruit', 'Jasmine', 'Musk'],   match: 89 },
  { house: 'Hermès',            name: 'Un Jardin sur le Nil',       notes: ['Green Mango', 'Lotus', 'Incense'],  match: 86 },
  { house: 'Guerlain',          name: "Après l'Ondée",              notes: ['Heliotrope', 'Violet', 'Anise'],   match: 83 },
  { house: 'Frederic Malle',    name: 'Portrait of a Lady',         notes: ['Rose', 'Patchouli', 'Sandalwood'], match: 90 },
  { house: 'Olfactories',       name: 'Playing with the Devil',     notes: ['Leather', 'Iris', 'Amber'],        match: 84 },
  { house: 'Juliette Has a Gun', name: 'Not a Perfume',             notes: ['Cetalox', 'White Musk'],           match: 82 },
];

function recommend() {
  // Shuffle and pick top 3 with slight score variation for realism
  const shuffled = [...DB]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(f => ({ ...f, match: Math.min(99, f.match + Math.floor(Math.random() * 6) - 3) }))
    .sort((a, b) => b.match - a.match);

  document.getElementById('frag-grid').innerHTML = shuffled.map(f => `
    <div class="frag-card">
      <div class="frag-house">${f.house}</div>
      <div class="frag-name">${f.name}</div>
      <div class="frag-notes">${f.notes.map(n => `<span class="note-tag">${n}</span>`).join('')}</div>
      <div class="match-row">
        <div class="match-bar"><div class="match-fill" style="width:${f.match}%"></div></div>
        <span class="match-pct">${f.match}%</span>
      </div>
    </div>
  `).join('');

  const results = document.getElementById('results');
  results.classList.add('show');
  results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
