const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '2mb' }));

// Servir el manifest.json con el MIME correcto
app.get('/manifest.json', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Proxy para el Chat del Tutor
app.post('/api/chat', async (req, res) => {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ error: 'Falta GROQ_API_KEY' });
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Proxy para Generar Módulos
app.post('/api/generate-module', async (req, res) => {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(500).json({ error: 'Falta GROQ_API_KEY en Render' });
    const { lenguaje, titulo, tema } = req.body;

    const prompt = `Genera exactamente 10 lecciones para un módulo de "${lenguaje}" nivel principiante titulado "${titulo}".
Tema del módulo: ${tema}.

Devuelve SOLO un array JSON válido (sin texto antes ni después, sin backticks) con esta estructura exacta:
[
  {
    "titulo": "Título corto de la lección",
    "teoria": "Explicación clara en español. Incluye un bloque de código de ejemplo entre triple backtick.",
    "preguntas": [
      {"q": "Pregunta clara", "opciones": ["a","b","c","d"], "correcta": 0, "explicacion": "Por qué esa es la respuesta correcta"}
    ]
  }
]

Reglas:
- Cada lección debe tener EXACTAMENTE 3 preguntas.
- Cada pregunta tiene EXACTAMENTE 4 opciones.
- "correcta" es el ÍNDICE (0-3) de la opción correcta.
- La "explicacion" es una oración clara en español.
- Toda la teoría y preguntas en español.
- Progresión pedagógica: de más simple a más complejo dentro del módulo.`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // Modelo actualizado
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t.slice(0, 200) });
    }

    const data = await r.json();
    let raw = data.choices?.[0]?.message?.content || '[]';
    let parsed;
    try {
      const j = JSON.parse(raw);
      parsed = Array.isArray(j) ? j : (j.lecciones || j.lessons || []);
    } catch (e) {
      const m = raw.match(/\[[\s\S]*\]/);
      if (!m) return res.status(500).json({ error: 'Respuesta IA no es JSON válido' });
      parsed = JSON.parse(m[0]);
    }
    res.json({ lecciones: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));
