(function () {
  "use strict";

  const cachePrefix = "mcq-ai-explanation-v2:";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function getQuestion(index) {
    try {
      return exam[index];
    } catch {
      return null;
    }
  }

  function getSelectedAnswers(index) {
    try {
      return [...(answers[index] || [])];
    } catch {
      return [];
    }
  }

  function getCurrentIndex() {
    try {
      return current;
    } catch {
      return -1;
    }
  }

  function endpointIsReady() {
    return (
      typeof window.MCQ_AI_ENDPOINT === "string" &&
      window.MCQ_AI_ENDPOINT.startsWith("https://") &&
      !window.MCQ_AI_ENDPOINT.includes("PASTE_YOUR")
    );
  }

  function createCacheKey(question) {
    const content = JSON.stringify({
      question: question.question,
      options: question.options,
      category: question.category,
      number: question.num
    });

    let hash = 0;

    for (let index = 0; index < content.length; index++) {
      hash = ((hash << 5) - hash + content.charCodeAt(index)) | 0;
    }

    return cachePrefix + Math.abs(hash);
  }

  function updateExplainButton() {
    const button = document.getElementById("explainBtn");
    const feedback = document.getElementById("feedback");

    if (!button || !feedback) {
      return;
    }

    button.textContent = "Explain with AI";
    button.classList.toggle(
      "hidden",
      feedback.classList.contains("hidden")
    );
  }

  const originalRenderQuestion = window.renderQuestion;

  if (typeof originalRenderQuestion === "function") {
    window.renderQuestion = function () {
      originalRenderQuestion.apply(this, arguments);
      updateExplainButton();

      const explanationBox =
        document.getElementById("explanation");

      if (explanationBox) {
        explanationBox.classList.add("hidden");
        explanationBox.innerHTML = "";
      }
    };
  }

  window.toggleExplanation = function (index) {
    return window.requestAIExplanation(
      index,
      document.getElementById("explainBtn")
    );
  };

  window.copyQuestionForAI = function (index) {
    return window.requestAIExplanation(index, null);
  };

  window.requestAIExplanation = async function (index, button) {
    const question = getQuestion(index);

    if (!question) {
      alert(
        "The question could not be read. Refresh the page and try again."
      );
      return;
    }

    if (!endpointIsReady()) {
      alert(
        "AI is not connected. Check the Vercel address in ai-config.js."
      );
      return;
    }

    let explanationBox;

    const examSection = document.getElementById("exam");

    if (
      examSection &&
      !examSection.classList.contains("hidden") &&
      index === getCurrentIndex()
    ) {
      explanationBox =
        document.getElementById("explanation");
    } else {
      const reviewCards =
        document.querySelectorAll("#reviewAll main.card");

      const reviewCard = reviewCards[index];

      if (!reviewCard) {
        alert("The explanation area could not be found.");
        return;
      }

      explanationBox =
        reviewCard.querySelector(".ai-review-explanation");

      if (!explanationBox) {
        explanationBox = document.createElement("div");
        explanationBox.className =
          "explain-box ai-review-explanation";

        reviewCard.appendChild(explanationBox);
      }
    }

    const cacheKey = createCacheKey(question);
    const cachedExplanation =
      localStorage.getItem(cacheKey);

    if (cachedExplanation) {
      explanationBox.innerHTML =
        "<h3>AI explanation</h3>" +
        '<div class="ai-text">' +
        escapeHtml(cachedExplanation).replace(/\n/g, "<br>") +
        "</div>";

      explanationBox.classList.remove("hidden");
      return;
    }

    const oldButtonText = button?.textContent;

    if (button) {
      button.disabled = true;
      button.textContent = "Explaining…";
    }

    explanationBox.classList.remove("hidden");
    explanationBox.innerHTML =
      '<div class="ai-loading">' +
      "Generating a clear explanation…" +
      "</div>";

    try {
      const response = await fetch(
        window.MCQ_AI_ENDPOINT.replace(/\/$/, "") +
          "/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: question.question,
            category: question.category,
            sourceNumber: question.num,
            options: question.options.map(option => ({
              letter: option.letter,
              text: option.text,
              correct: Boolean(option.correct)
            })),
            selectedAnswers:
              getSelectedAnswers(index)
          })
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          "The AI service returned an error."
        );
      }

      const explanation = String(
        data.explanation ||
        "No explanation was returned."
      );

      localStorage.setItem(cacheKey, explanation);

      explanationBox.innerHTML =
        "<h3>AI explanation</h3>" +
        '<div class="ai-text">' +
        escapeHtml(explanation).replace(/\n/g, "<br>") +
        "</div>" +
        '<div class="small-note">' +
        "AI can make mistakes. Check important medical facts " +
        "against your course materials." +
        "</div>";
    } catch (error) {
      explanationBox.innerHTML =
        '<div class="ai-error">' +
        "<strong>Could not load the explanation.</strong><br>" +
        escapeHtml(error.message) +
        "<br><br>" +
        "Check the Vercel deployment and Gemini key, then try again." +
        "</div>";
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          oldButtonText || "Explain with AI";
      }
    }
  };

  document.addEventListener(
    "DOMContentLoaded",
    updateExplainButton
  );
})();
