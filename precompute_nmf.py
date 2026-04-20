"""
Ran once to pre compute the NMF W Matrix.
"""

import pandas as pd
import numpy as np
import json
from sklearn.decomposition import NMF

# Load
df = pd.read_csv('fra_cleaned.csv', encoding='latin-1', sep=';')

def get_all_notes(row):
    notes = []
    for col in ['Top', 'Middle', 'Base']:
        if pd.notna(row[col]):
            notes.extend([n.strip().lower() for n in row[col].split(',')])
    return notes

df['all_notes'] = df.apply(get_all_notes, axis=1)

# build matrix
unique_notes = set()
for notes_list in df['all_notes']:
    unique_notes.update(notes_list)

sorted_notes = sorted(unique_notes)
note_to_index = {note: i for i, note in enumerate(sorted_notes)}
note_matrix = np.zeros((len(df), len(note_to_index)), dtype=int)

for row_idx, notes_list in enumerate(df['all_notes']):
    for note in notes_list:
        note_matrix[row_idx, note_to_index[note]] = 1

# TF-IDF
N = note_matrix.shape[0]
df_t = note_matrix.sum(axis=0)
idf = np.log(N / df_t)
tfidf_matrix = note_matrix * idf

# NMF (filtering vague 'x notes' and 'spices')
vague = {i for i, n in enumerate(sorted_notes) if 'notes' in n or n == 'spices'}
keep = sorted(set(range(len(sorted_notes))) - vague)
tfidf_filtered = tfidf_matrix[:, keep]

k = 15
model = NMF(n_components=k, random_state=42, max_iter=500)
W = model.fit_transform(tfidf_filtered)

# EXPORT
# W matrix, rounded to 4 decimal places 
# Labels: my labels for k=15 archetypes
w_list = np.round(W, 4).tolist()

out = {
    "labels": [
        "Fruity Rose", 
        "Aromatic Fougere", 
        "Oud", 
        "Vintage Floral",
        "White Floral", 
        "Gourmand", 
        "Niche Citrus", 
        "Powdery Violet",
        "Hesperidic", 
        "Fresh Citrus", 
        "Resinous Amber", 
        "Fresh Floral",
        "Fruity Aquatic", 
        "Modern Musk", 
        "Leather & Tobacco",
    ],
    "W": w_list,
}

with open('nmf_w.json', 'w') as f:
    json.dump(out, f)

print(f"Wrote nmf_w.json ({len(w_list)} fragrances x {k} archetypes)")
