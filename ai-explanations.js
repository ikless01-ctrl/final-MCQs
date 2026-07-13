const ALLOWED_ORIGIN = "https://ikless01-ctrl.github.io";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function buildPrompt(body) {
  const options = body.options
    .map((option) => `${option.letter}. ${option.text}`)
    .join("\n");

  const correctAnswers = body.options
    .filter((option) => Boolean(option.correct))
    .map((option) => `${option.letter}. ${option.text}`)
    .join("\n");

  const selectedAnswers =
    Array.isArray(body.selectedAnswers) && body.selectedAnswers.length
      ? body.selectedAnswers.join(", ")
      : "No answer selected";

  return `
You are a careful university pathophysiology tutor.

Explain in the same language as the question.
Explain why every officially correct option is correct.
Briefly explain why every incorrect option is incorrect.
Treat the supplied answer key as the expected exam answer, but clearly flag ambiguity or a likely error instead of inventing a justification.
Be concise, educational, and do not provide personal medical advice.

Category: ${body.category || "Pathophysiology"}

Question:
${body.question}

Options:
${options}

Official correct answer(s):
${correctAnswers || "Not supplied"}

Student selected:
${selectedAnswers}
`.trim();
}

async function callGemini(model, apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}
function extractText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY has not been added in Vercel."
    });
  }

  try {
    const body = req.body || {};

    if (
      typeof body.question !== "string" ||
      !Array.isArray(body.options) ||
      body.options.length < 2
    ) {
      return res.status(400).json({
        error: "Invalid question data."
      });
    }

    const prompt = buildPrompt(body);

    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite-preview-06-17",
      "gemini-2.5-pro"
    ];

    const errors = [];

    for (const model of models) {
      const result = await callGemini(
        model,
        process.env.GEMINI_API_KEY,
        prompt
      );

      if (result.ok) {
        const explanation = extractText(result.data);

        if (explanation) {
          return res.status(200).json({
            explanation,
            model
          });
        }

        errors.push(`${model}: no explanation returned`);
        continue;
      }

      const message =
        result.data?.error?.message ||
        `HTTP ${result.status}`;

      errors.push(`${model}: ${message}`);
    }
        return res.status(502).json({
      error:
        "Gemini could not generate an explanation. " +
        errors.join(" | ")
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error."
    });
  }
};
    
