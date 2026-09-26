(() => {
  "use strict";

  const config = window.ICE_BLUE_CONFIG || {};
  const form = document.querySelector("#survey-form");
  const steps = [...document.querySelectorAll(".form-step")];
  const nextButton = document.querySelector("[data-next]");
  const prevButton = document.querySelector("[data-prev]");
  const submitButton = document.querySelector("[data-submit]");
  const progressBar = document.querySelector("#progress-bar");
  const stepLabel = document.querySelector("#step-label");
  const status = document.querySelector("#form-status");
  const successCard = document.querySelector("#success-card");
  const surveyIntro = document.querySelector(".survey-intro");
  const demoBanner = document.querySelector("#demo-banner");
  let currentStep = 1;

  const isConfigured =
    typeof config.appsScriptUrl === "string" &&
    /^https:\/\/script\.google\.com\//.test(config.appsScriptUrl) &&
    !config.appsScriptUrl.includes("COLLEZ_ICI");
  const isDemo = config.demoMode !== false || !isConfigured;

  if (isDemo) demoBanner.hidden = false;

  document.querySelector("[data-start]")?.addEventListener("click", () => {
    document.querySelector("#sondage")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll(".choice-card input").forEach((input) => {
    input.addEventListener("change", () => {
      input.closest(".choice-card")?.classList.toggle("is-selected", input.checked);
      clearGroupError(input.name);
    });
  });

  const otherFieldMap = {
    otherFlavor: "flavors",
    otherMix: "mixes",
    otherTopping: "toppings",
    otherSauce: "sauces",
  };

  Object.entries(otherFieldMap).forEach(([fieldName, groupName]) => {
    form.elements[fieldName]?.addEventListener("input", () => clearGroupError(groupName));
  });

  form.elements.consent?.addEventListener("change", () => clearGroupError("consent"));
  nextButton.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    showStep(currentStep + 1);
  });
  prevButton.addEventListener("click", () => showStep(currentStep - 1));

  function showStep(stepNumber) {
    currentStep = Math.max(1, Math.min(steps.length, stepNumber));
    steps.forEach((step) => {
      const isActive = Number(step.dataset.step) === currentStep;
      step.hidden = !isActive;
      step.classList.toggle("is-active", isActive);
    });
    stepLabel.textContent = `Étape ${currentStep} sur ${steps.length}`;
    progressBar.style.width = `${(currentStep / steps.length) * 100}%`;
    prevButton.hidden = currentStep === 1;
    nextButton.hidden = currentStep === steps.length;
    submitButton.hidden = currentStep !== steps.length;
    status.textContent = "";
    const heading = steps[currentStep - 1].querySelector("h3");
    heading?.focus({ preventScroll: true });
    document.querySelector("#sondage")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function valuesFor(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function setError(name, message) {
    const target = form.querySelector(`[data-error="${name}"]`);
    if (target) target.textContent = message;
  }

  function clearGroupError(name) {
    setError(name, "");
  }

  function validateStep(stepNumber) {
    const validations = {
      1: ["flavors", "otherFlavor", "Sélectionnez au moins un parfum ou écrivez votre proposition."],
      2: ["mixes", "otherMix", "Sélectionnez un mélange ou écrivez votre proposition."],
      3: ["toppings", "otherTopping", "Sélectionnez un topping, « Sans topping », ou écrivez votre proposition."],
      4: ["sauces", "otherSauce", "Sélectionnez une sauce, « Sans sauce », ou écrivez votre proposition."],
    };

    if (validations[stepNumber]) {
      const [groupName, otherName, message] = validations[stepNumber];
      const valid = valuesFor(groupName).length > 0 || form.elements[otherName].value.trim().length > 0;
      setError(groupName, valid ? "" : message);
      if (!valid) {
        form.querySelector(`[data-required-group="${groupName}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return valid;
    }

    if (stepNumber === 5 && !form.elements.consent.checked) {
      setError("consent", "Veuillez confirmer votre accord avant l’envoi.");
      form.elements.consent.focus();
      return false;
    }
    return true;
  }

  function makeSubmission() {
    return {
      submissionId:
        window.crypto?.randomUUID?.() || `iceblue-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      firstName: form.elements.firstName.value.trim(),
      ageRange: form.elements.ageRange.value,
      frequency: form.elements.frequency.value,
      flavors: valuesFor("flavors"),
      otherFlavor: form.elements.otherFlavor.value.trim(),
      mixes: valuesFor("mixes"),
      otherMix: form.elements.otherMix.value.trim(),
      toppings: valuesFor("toppings"),
      otherTopping: form.elements.otherTopping.value.trim(),
      sauces: valuesFor("sauces"),
      otherSauce: form.elements.otherSauce.value.trim(),
      suggestion: form.elements.suggestion.value.trim(),
      source: window.location.href.split("?")[0],
      submittedAt: new Date().toISOString(),
    };
  }

  async function saveSubmission(payload) {
    if (isDemo) {
      const saved = JSON.parse(localStorage.getItem("iceblue_demo_responses") || "[]");
      saved.push(payload);
      localStorage.setItem("iceblue_demo_responses", JSON.stringify(saved.slice(-100)));
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      return;
    }

    const body = new URLSearchParams({ payload: JSON.stringify(payload) });
    await fetch(config.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      redirect: "follow",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.elements.website.value || !validateStep(5)) return;

    submitButton.disabled = true;
    submitButton.querySelector(".submit-label").hidden = true;
    submitButton.querySelector(".submit-loading").hidden = false;
    status.textContent = "";

    try {
      await saveSubmission(makeSubmission());
      form.hidden = true;
      surveyIntro.hidden = true;
      demoBanner.hidden = true;
      successCard.hidden = false;
      successCard.focus();
    } catch (error) {
      console.error(error);
      status.textContent = "La réponse n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.";
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector(".submit-label").hidden = false;
      submitButton.querySelector(".submit-loading").hidden = true;
    }
  });

  document.querySelector("[data-restart]")?.addEventListener("click", () => {
    form.reset();
    document.querySelectorAll(".choice-card").forEach((card) => card.classList.remove("is-selected"));
    form.hidden = false;
    surveyIntro.hidden = false;
    demoBanner.hidden = !isDemo;
    successCard.hidden = true;
    showStep(1);
  });

  showStep(1);
})();
