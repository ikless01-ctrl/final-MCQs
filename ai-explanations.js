(function () {
  "use strict";

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function showExplainButton() {
    const button = document.getElementById("explainBtn");
    const feedback = document.getElementById("feedback");

    if (!button || !feedback) return;

    if (!feedback.classList.contains("hidden")) {
      button.classList.remove("hidden");
    }
  }

  const originalCheckAnswer = window.checkCurrentQuestion;

  if (typeof originalCheckAnswer === "function") {
    window.checkCurrentQuestion = function () {
      originalCheckAnswer.apply(this, arguments);
      showExplainButton();
    };
  }

  const originalRenderQuestion = window.renderQuestion;

  if (typeof originalRenderQuestion === "function") {
    window.renderQuestion = function () {
      originalRenderQuestion.apply(this, arguments);

      const button = document.getElementById("explainBtn");
      const explanation = document.getElementById("explanation");

      if (button) {
        button.classList.add("hidden");
        button.disabled = false;
        button.textContent = "Explain with AI";
      }

      if (explanation) {
        explanation.classList.add("hidden");
        explanation.innerHTML = "";
      }

      showExplainButton();
    };
  }

  window.toggleExplanation = async function (questionIndex) {
    const button = document.getElementById("explainBtn");
    const explanationBox = document.getElementById("explanation");

    if (!button || !explanationBox) {
      alert("The explanation area could not be found.");
      return;
    }

    let question;

    try {
      question = exam[questionIndex];
    } catch (error) {
      question = null;
    }

    if (!question) {
      alert("The question could not be read. Refresh the page and try again.");
      return;
    }

    if (
      typeof window.MCQ_AI_ENDPOINT !== "string" ||
      !window.MCQ_AI_ENDPOINT.startsWith("https://")
    ) {
      alert("The AI connection is not configured.");
      return;
    }

    button.disabled = true;
    button.textContent = "Explaining…";

    explanationBox.classList.remove("hidden");
    explanationBox.innerHTML =
      '<div class="ai-loading">Generating an explanation…</div>';

    let selectedAnswers = [];

    try {
      selectedAnswers = Array.from(answers[questionIndex] || []);
    } catch (error) {
      selectedAnswers = [];
    }

    try {
      const response = await fetch(
        window.MCQ_AI_ENDPOINT.replace(/\/$/, "") + "/explain",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: question.question,
            category: question.category,
            options: question.options.map(function (option) {
              return {
                letter: option.letter,
                text: option.text,
                correct: Boolean(option.correct)
              };
            }),
            selectedAnswers: selectedAnswers
          })
        }
      );

      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(
          data.error || "The AI service returned an error."
        );
      }

      const explanation =
        data.explanation || "No explanation was returned.";

      explanationBox.innerHTML =
        "<h3>AI explanation</h3>" +
        '<div class="ai-text">' +
        safeText(explanation).replace(/\n/g, "<br>") +
        "</div>" +
        '<div class="small-note">' +
        "AI can make mistakes. Check important medical facts against your course materials." +
        "</div>";
    } catch (error) {
      explanationBox.innerHTML =
        '<div class="ai-error">' +
        "<strong>Could not load the explanation.</strong><br>" +
        safeText(error.message) +
        "</div>";
    } finally {
      button.disabled = false;
      button.textContent = "Explain with AI";
    }
  };

  document.addEventListener("DOMContentLoaded", showExplainButton);
    function updateReviewButtons() {
    const reviewCards =
      document.querySelectorAll("#reviewAll main.card");

    reviewCards.forEach(function (card, index) {
      const button =
        card.querySelector(".explain-actions button");

      if (!button) return;

      button.textContent = "Explain with AI";
      button.classList.remove("light");
      button.classList.add("ai-button");

      button.onclick = async function () {
        let explanationBox =
          card.querySelector(".ai-review-explanation");

        if (!explanationBox) {
          explanationBox = document.createElement("div");
          explanationBox.className =
            "explain-box ai-review-explanation";
          card.appendChild(explanationBox);
        }

        let question;

        try {
          question = exam[index];
        } catch {
          question = null;
        }

        if (!question) {
          alert("The question could not be read.");
          return;
        }

        button.disabled = true;
        button.textContent = "Explaining…";

        explanationBox.classList.remove("hidden");
        explanationBox.innerHTML =
          '<div class="ai-loading">Generating an explanation…</div>';

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
                options: question.options.map(function (option) {
                  return {
                    letter: option.letter,
                    text: option.text,
                    correct: Boolean(option.correct)
                  };
                }),
                selectedAnswers: Array.from(
                  answers[index] || []
                )
              })
            }
          );

          const data = await response.json().catch(function () {
            return {};
          });

          if (!response.ok) {
            throw new Error(
              data.error ||
              "The AI service returned an error."
            );
          }

          explanationBox.innerHTML =
            "<h3>AI explanation</h3>" +
            '<div class="ai-text">' +
            safeText(data.explanation || "")
              .replace(/\n/g, "<br>") +
            "</div>";
        } catch (error) {
          explanationBox.innerHTML =
            '<div class="ai-error">' +
            "<strong>Could not load the explanation.</strong><br>" +
            safeText(error.message) +
            "</div>";
        } finally {
          button.disabled = false;
          button.textContent = "Explain with AI";
        }
      };
    });
  }

  const originalRenderFullReview =
    window.renderFullReview;

  if (typeof originalRenderFullReview === "function") {
    window.renderFullReview = function () {
      originalRenderFullReview.apply(this, arguments);
      updateReviewButtons();
    };
  }
})();
