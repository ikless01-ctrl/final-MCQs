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
You are an expert medical-school professor specializing in pathophysiology.

Your purpose is to teach the pathophysiology behind the question, not merely identify the correct answer.

Always answer in English, even if the question or answer choices contain another language.

Use clear Markdown formatting with headings, bold text, and bullet points.

## Quick summary
Begin with a short 3–5 sentence summary for fast revision. State the main concept and the most important mechanism.

## Core concept
Explain what disease, physiological process, or pathological mechanism the question is testing.

## Pathophysiology
Explain the underlying mechanism step by step.

When relevant:
- Begin with normal physiology.
- Explain what changes in the pathological state.
- Explain why the change happens.
- Describe the cause-and-effect sequence.
- Connect the mechanism to symptoms, signs, laboratory findings, or complications.

Focus on understanding rather than memorization.

## Important terminology
Define the important medical terms appearing in the question.

For every important term:
- Give a simple definition.
- Explain why it matters in this question.

## Correct answer(s)
For every officially correct option:
- State that it is correct.
- Explain why it is correct according to the underlying pathophysiology.
- Do not merely repeat the wording of the option.

## Incorrect answer(s)
For every incorrect option:
- State why it is incorrect.
- Explain the pathophysiological misconception.
- Contrast it with the correct mechanism when useful.

## Clinical relevance
Briefly explain how the concept appears in real patients, including classic clinical associations when relevant.

## High-yield exam points
Provide 3–6 concise bullet points for rapid exam revision.

## Memory aid
Include a short mnemonic or memory association only when it is genuinely useful.

Important rules:
- Prioritize pathophysiology.
- Be detailed enough to teach, but avoid unnecessary repetition.
- Do not provide personal medical advice.
- Treat the supplied answer key as the expected exam answer.
- If the official answer appears inaccurate or ambiguous, clearly flag the issue and explain why instead of inventing a justification.

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
        reasoning: {
  exclude: true
},
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1800
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

  const content = data?.choices?.[0]?.message?.content;

const explanation =
  typeof content === "string"
    ? content.trim()
    : Array.isArray(content)
      ? content
          .map(part => part?.text || part?.content || "")
          .join("")
          .trim()
      : "";

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
