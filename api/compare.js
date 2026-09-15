// Vercel serverless function — queries the Orb and Metronome Mintlify
// docs assistants and returns both raw answers as JSON.
// No API keys needed, no dependencies to install — uses Node's built-in fetch.

const PRODUCTS = {
  metronome: {
    fp: "metronome-b35a6a36",
    name: "Metronome",
    docs: "https://docs.metronome.com",
    path: "/guides/pricing-packaging/billing-model-guides/enterprise-commit",
  },
  orb: {
    fp: "orb-9bba378a",
    name: "Orb",
    docs: "https://docs.withorb.com",
    path: "/overview",
  },
};

async function queryMintlify(key, question) {
  const p = PRODUCTS[key];
  const url = `https://leaves.mintlify.com/api/assistant/${p.fp}/message`;

  const payload = {
    fp: p.fp,
    threadId: null,
    threadKey: null,
    messages: [
      {
        id: "msg_" + Math.random().toString(16).slice(2, 10),
        role: "user",
        content: question,
        parts: [{ type: "text", text: question }],
      },
    ],
    currentPath: p.path,
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: p.docs,
        Referer: p.docs + "/",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return `[ERROR querying ${p.name}: HTTP ${resp.status} — ${body.slice(0, 300)}]`;
    }

    const raw = await resp.text();
    const lines = raw.split("\n");
    const chunks = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("0:")) {
        try {
          chunks.push(JSON.parse(line.slice(2)));
        } catch {
          chunks.push(line.slice(2));
        }
      } else if (line.startsWith("d:")) {
        break;
      }
    }

    return chunks.join("");
  } catch (e) {
    return `[ERROR querying ${p.name}: ${e.message}]`;
  }
}

module.exports = async function handler(req, res) {
  const question =
    (req.query && req.query.question) ||
    (req.body && req.body.question);

  if (!question) {
    res.status(400).json({ error: "Missing 'question'." });
    return;
  }

  try {
    const [metronome, orb] = await Promise.all([
      queryMintlify("metronome", question),
      queryMintlify("orb", question),
    ]);
    res.status(200).json({ question, metronome, orb });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
