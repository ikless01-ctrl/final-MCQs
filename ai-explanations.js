(function () {
  "use strict";

  const cachePrefix = "mcq-ai-explanation-v1:";

  function escapeHtmlSafe(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[ch]));
  }

  function endpointIsReady() {
    return typeof window.MCQ_AI_ENDPOINT === "string" &&
      /^https:\/\//.test(window.MCQ_AI_ENDPOINT) &&
      !window.MCQ_AI_ENDPOINT.includes("PASTE_YOUR");
  }

  function questionKey(q) {
    const raw = JSON.stringify({ q: q.question, o: q.options, c: q.category, n: q.num });
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return cachePrefix + Math.abs(hash);
  }

  function showMainButton() {
    const btn = document.getElementById("explainBtn");
    const feedback = document.getElementById("feedback");
    if (!btn || !feedback) return;
    btn.textContent = "Explain with AI";
    btn.classList.toggle("hidden", feedback.classList.contains("hidden"));
  }

  const originalRenderQuestion = window.renderQuestion;
  if (typeof originalRenderQuestion === "function") {
    window.renderQuestion = function () {
      originalRenderQuestion.apply(this, arguments);
      showMainButton();
      const box = document.getElementById("explanation");
      if (box) { box.classList.add("hidden"); box.innerHTML = ""; }
    };
  }

  function refreshReviewButtons() {
    document.querySelectorAll("#reviewAll .explain-actions button").forEach((button, index) => {
      button.textContent = "Explain with AI";
      button.classList.remove("light");
      button.classList.add("ai-button");
      button.onclick = () => window.requestAIExplanation(index, button);
    });
  }

  const originalFullReview = window.renderFullReview;
  if (typeof originalFullReview === "function") {
    window.renderFullReview = function () {
      originalFullReview.apply(this, arguments);
      refreshReviewButtons();
    };
  }

  window.toggleExplanation = function (i) {
    return window.requestAIExplanation(i, document.getElementById("explainBtn"));
  };
  window.copyQuestionForAI = function (i) {
    return window.requestAIExplanation(i, null);
  };

  window.requestAIExplanation = async function (i, button) {
    const q = window.exam?.[i];
    if (!q) return;

    if (!endpointIsReady()) {
      alert("AI is not connected yet. Open ai-config.js and paste your Cloudflare Worker URL.");
      return;
    }

    let box;
    if (document.getElementById("exam") && !document.getElementById("exam").classList.contains("hidden") && i === window.current) {
      box = document.getElementById("explanation");
    } else {
      const cards = document.querySelectorAll("#reviewAll main.card");
      const card = cards[i];
      if (!card) return;
      box = card.querySelector(".ai-review-explanation");
      if (!box) {
        box = document.createElement("div");
        box.className = "explain-box ai-review-explanation";
        card.appendChild(box);
      }
    }

    const key = questionKey(q);
    const cached = localStorage.getItem(key);
    if (cached) {
      box.innerHTML = `<h3>AI explanation</h3><div class="ai-text">${escapeHtmlSafe(cached).replace(/\n/g, "<br>")}</div>`;
      box.classList.remove("hidden");
      return;
    }

    const oldText = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "Explaining…"; }
    box.classList.remove("hidden");
    box.innerHTML = '<div class="ai-loading">Generating a clear explanation…</div>';

    try {
      const selected = [...(window.answers?.[i] || [])];
      const response = await fetch(window.MCQ_AI_ENDPOINT.replace(/\/$/, "") + "/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          category: q.category,
          sourceNumber: q.num,
          options: q.options.map(o => ({ letter: o.letter, text: o.text, correct: !!o.correct })),
          selectedAnswers: selected
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The AI service returned an error.");
      const explanation = String(data.explanation || "No explanation was returned.");
      localStorage.setItem(key, explanation);
      box.innerHTML = `<h3>AI explanation</h3><div class="ai-text">${escapeHtmlSafe(explanation).replace(/\n/g, "<br>")}</div><div class="small-note">AI can make mistakes. Use this as a study aid and check important medical facts against your course materials.</div>`;
    } catch (error) {
      box.innerHTML = `<div class="ai-error"><strong>Could not load the explanation.</strong><br>${escapeHtmlSafe(error.message)}<br><br>Check the Worker URL and API key, then try again.</div>`;
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText || "Explain with AI"; }
    }
  };

  document.addEventListener("DOMContentLoaded", showMainButton);
})();
