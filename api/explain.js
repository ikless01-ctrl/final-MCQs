const ALLOWED_ORIGIN = "https://ikless01-ctrl.github.io";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
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

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY has not been added in Vercel."
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

    const options = body.options
      .map(option => `${option.letter}. ${option.text}`)
      .join("\n");

    const correctAnswers = body.options
      .filter(option => Boolean(option.correct))
      .map(option => `${option.letter}. ${option.text}`)
      .join("\n");

    const selectedAnswers =
      Array.isArray(body.selectedAnswers) &&
      body.selectedAnswers.length
        ? body.selectedAnswers.join(", ")
        : "No answer selected";

    const prompt = `
You are a careful university pathophysiology tutor.

Explain in the same language as the question.
Explain why every officially correct option is correct.
Briefly explain why every incorrect option is incorrect.
Treat the supplied answer key as the expected exam answer, but clearly flag ambiguity or a likely error.
Be concise, educational, and do not provide personal medical advice.

Category:
${body.category || "Pathophysiology"}

Question:
${body.question}

Options:
${options}

Official correct answer(s):
${correctAnswers || "Not supplied"}

Student selected:
${selectedAnswers}
`.trim();

    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ikless01-ctrl.github.io/final-MCQs/",
          "X-Title": "Pathophysiology MCQ Explainer"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 900
        })
      }
    );

    const data = await openRouterResponse.json();

    if (!openRouterResponse.ok) {
      return res.status(openRouterResponse.status).json({
        error:
          data?.error?.message ||
          "OpenRouter returned an error."
      });
    }

    const explanation =
      data?.choices?.[0]?.message?.content?.trim();

    if (!explanation) {
      return res.status(502).json({
        error: "OpenRouter did not return an explanation."
      });
    }

    return res.status(200).json({
      explanation
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error?.message ||
        "Unexpected server error."
    });
  }
};
