(() => {
  "use strict";

  const config = window.ICE_BLUE_CONFIG || {};
  const loginCard = document.querySelector("#login-card");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const dashboard = document.querySelector("#dashboard-content");
  const demoLogin = document.querySelector("#demo-login");
  const notice = document.querySelector("#admin-notice");
  let activeKey = "";
  let demoActive = false;

  const isConfigured =
    typeof config.appsScriptUrl === "string" &&
    /^https:\/\/script\.google\.com\//.test(config.appsScriptUrl) &&
    !config.appsScriptUrl.includes("COLLEZ_ICI");
  const demoAvailable = config.demoMode !== false || !isConfigured;
  demoLogin.hidden = !demoAvailable;

  const demoResponses = buildDemoResponses();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const key = new FormData(loginForm).get("adminKey").trim();
    if (!isConfigured) {
      loginError.textContent = "Connectez d’abord l’URL Apps Script dans assets/config.js, ou utilisez la démonstration.";
      return;
    }
    await openLiveDashboard(key);
  });

  document.querySelector("#demo-button")?.addEventListener("click", () => {
    demoActive = true;
    const localResponses = readLocalResponses();
    showDashboard(aggregate([...demoResponses, ...localResponses]));
    document.querySelector("#mode-pill").textContent = "Données de démonstration";
    notice.hidden = false;
    notice.innerHTML = `<strong>Aperçu actif.</strong> ${localResponses.length} réponse(s) saisie(s) sur cet appareil sont ajoutées aux exemples.`;
  });

  document.querySelector("#refresh-button").addEventListener("click", async () => {
    if (demoActive) {
      showDashboard(aggregate([...demoResponses, ...readLocalResponses()]));
      return;
    }
    if (activeKey) await openLiveDashboard(activeKey, true);
  });

  document.querySelector("#logout-button").addEventListener("click", () => {
    activeKey = "";
    demoActive = false;
    sessionStorage.removeItem("iceblue_admin_key");
    dashboard.hidden = true;
    loginCard.hidden = false;
    loginForm.reset();
  });

  async function openLiveDashboard(key, silent = false) {
    if (!key) {
      loginError.textContent = "Saisissez votre code administrateur.";
      return;
    }
    const submit = loginForm.querySelector("button[type='submit']");
    if (!silent) {
      submit.disabled = true;
      submit.textContent = "Connexion…";
    }
    try {
      const data = await fetchJsonp(config.appsScriptUrl, { action: "stats", key });
      if (!data?.ok) throw new Error(data?.error || "Accès refusé");
      activeKey = key;
      sessionStorage.setItem("iceblue_admin_key", key);
      showDashboard(data);
      document.querySelector("#mode-pill").textContent = "Données en direct";
      notice.hidden = true;
    } catch (error) {
      loginError.textContent = error.message === "Accès refusé" ? "Code incorrect." : "Connexion impossible. Vérifiez le code et l’URL Apps Script.";
      if (silent) {
        notice.hidden = false;
        notice.textContent = "Actualisation impossible. Les derniers résultats chargés restent affichés.";
      }
    } finally {
      submit.disabled = false;
      submit.textContent = "Ouvrir le tableau de bord";
    }
  }

  function fetchJsonp(url, params) {
    return new Promise((resolve, reject) => {
      const callbackName = `iceBlueCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => cleanup(new Error("Délai dépassé")), 15000);
      const query = new URLSearchParams({ ...params, callback: callbackName, _: Date.now().toString() });

      function cleanup(error, value) {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
        error ? reject(error) : resolve(value);
      }

      window[callbackName] = (payload) => cleanup(null, payload);
      script.onerror = () => cleanup(new Error("Connexion impossible"));
      script.src = `${url}${url.includes("?") ? "&" : "?"}${query}`;
      document.body.appendChild(script);
    });
  }

  function showDashboard(data) {
    loginCard.hidden = true;
    dashboard.hidden = false;

    const total = Number(data.total || 0);
    const topFlavor = data.categories?.flavors?.[0];
    const topMix = data.categories?.mixes?.[0];
    document.querySelector("#total-responses").textContent = total.toLocaleString("fr-FR");
    document.querySelector("#top-flavor").textContent = topFlavor?.label || "—";
    document.querySelector("#top-flavor-share").textContent = topFlavor ? `${topFlavor.percentage} % des répondants` : "Aucune donnée";
    document.querySelector("#top-mix").textContent = topMix?.label || "—";
    document.querySelector("#top-mix-share").textContent = topMix ? `${topMix.percentage} % des répondants` : "Aucune donnée";

    const last = data.lastResponseAt ? new Date(data.lastResponseAt) : null;
    document.querySelector("#last-response").textContent = last && !Number.isNaN(last.valueOf())
      ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(last)
      : "—";
    document.querySelector("#last-response-time").textContent = last && !Number.isNaN(last.valueOf())
      ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(last)
      : "En attente";

    const start = data.periodStart ? formatDate(data.periodStart) : null;
    const end = data.periodEnd ? formatDate(data.periodEnd) : null;
    document.querySelector("#dashboard-period").textContent = start && end
      ? `Réponses du ${start} au ${end} · actualisé à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`
      : "Le tableau de bord se remplira avec les premières réponses.";

    renderChart("chart-flavors", data.categories?.flavors || [], total);
    renderChart("chart-mixes", data.categories?.mixes || [], total);
    renderChart("chart-toppings", data.categories?.toppings || [], total);
    renderChart("chart-sauces", data.categories?.sauces || [], total);
    renderInsights(data);
    renderSuggestions(data.suggestions || []);
  }

  function renderChart(id, items, total) {
    const container = document.querySelector(`#${id}`);
    container.replaceChildren();
    if (!total || !items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Aucune réponse pour le moment.";
      container.appendChild(empty);
      return;
    }

    items.slice(0, 8).forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const safeWidth = Math.max(2, Math.min(100, Number(item.percentage || 0)));
      row.innerHTML = `
        <div class="bar-label"><span class="rank">${String(index + 1).padStart(2, "0")}</span><strong></strong><span>${item.count} vote${item.count > 1 ? "s" : ""}</span></div>
        <div class="bar-track"><span style="width:${safeWidth}%"></span><b>${item.percentage}&nbsp;%</b></div>`;
      row.querySelector("strong").textContent = item.label;
      container.appendChild(row);
    });
  }

  function renderInsights(data) {
    const list = document.querySelector("#insight-list");
    list.replaceChildren();
    const categories = data.categories || {};
    const flavor = categories.flavors?.[0];
    const mix = categories.mixes?.[0];
    const topping = categories.toppings?.[0];
    const sauce = categories.sauces?.[0];
    const insights = [];

    if (!data.total) {
      insights.push("Les interprétations apparaîtront dès la première réponse reçue.");
    } else {
      if (flavor) insights.push(`${flavor.label} arrive en tête des parfums avec ${flavor.percentage} % des répondants.`);
      if (mix) insights.push(`Le mélange le plus demandé est « ${mix.label} » (${mix.percentage} %).`);
      if (topping && sauce) insights.push(`L’association à tester en priorité d’après les votes : ${topping.label.toLowerCase()} avec une sauce ${sauce.label.toLowerCase()}.`);
      if (flavor && flavor.percentage < 45) insights.push("Les goûts sont assez dispersés : un test en plusieurs petites séries serait plus prudent qu’un seul lancement massif.");
      if (flavor && flavor.percentage >= 60) insights.push("Le parfum en tête rassemble une majorité nette : il constitue un candidat solide pour un premier test.");
    }

    insights.slice(0, 4).forEach((text, index) => {
      const item = document.createElement("div");
      item.className = "insight-item";
      item.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><p></p>`;
      item.querySelector("p").textContent = text;
      list.appendChild(item);
    });
  }

  function renderSuggestions(suggestions) {
    const cloud = document.querySelector("#suggestion-cloud");
    cloud.replaceChildren();
    if (!suggestions.length) {
      cloud.innerHTML = '<p class="empty-state">Aucune suggestion libre pour le moment.</p>';
      return;
    }
    suggestions.slice(0, 12).forEach((suggestion) => {
      const item = document.createElement("blockquote");
      item.textContent = `“${suggestion}”`;
      cloud.appendChild(item);
    });
  }

  function aggregate(responses) {
    const categories = { flavors: {}, mixes: {}, toppings: {}, sauces: {} };
    const otherFields = {
      flavors: "otherFlavor",
      mixes: "otherMix",
      toppings: "otherTopping",
      sauces: "otherSauce",
    };

    responses.forEach((response) => {
      Object.keys(categories).forEach((category) => {
        const selected = new Set(Array.isArray(response[category]) ? response[category] : []);
        const other = String(response[otherFields[category]] || "").trim();
        if (other) selected.add(`Autre — ${other}`);
        selected.forEach((label) => {
          categories[category][label] = (categories[category][label] || 0) + 1;
        });
      });
    });

    const total = responses.length;
    const finalized = Object.fromEntries(
      Object.entries(categories).map(([name, values]) => [
        name,
        Object.entries(values)
          .map(([label, count]) => ({ label, count, percentage: total ? Math.round((count / total) * 100) : 0 }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")),
      ])
    );
    const dates = responses.map((item) => new Date(item.submittedAt)).filter((date) => !Number.isNaN(date.valueOf())).sort((a, b) => a - b);
    return {
      ok: true,
      total,
      categories: finalized,
      periodStart: dates[0]?.toISOString() || null,
      periodEnd: dates.at(-1)?.toISOString() || null,
      lastResponseAt: dates.at(-1)?.toISOString() || null,
      suggestions: responses.map((item) => String(item.suggestion || "").trim()).filter(Boolean).reverse(),
    };
  }

  function readLocalResponses() {
    try {
      return JSON.parse(localStorage.getItem("iceblue_demo_responses") || "[]");
    } catch {
      return [];
    }
  }

  function buildDemoResponses() {
    const flavors = [["Mangue", "Vanille"], ["Chocolat"], ["Mangue", "Fruit de la passion"], ["Coco"], ["Vanille", "Fraise"], ["Chocolat", "Caramel"]];
    const mixes = [["Mangue + passion"], ["Vanille + chocolat"], ["Coco + chocolat"], ["Mangue + passion", "Fraise + vanille"], ["Je préfère un seul parfum"], ["Caramel + café"]];
    const toppings = [["Fruits frais", "Brisures de spéculoos"], ["Éclats de chocolat"], ["Fruits frais"], ["Copeaux de coco"], ["Brisures de biscuits chocolatés"], ["Noisettes", "Éclats de chocolat"]];
    const sauces = [["Passion"], ["Chocolat"], ["Mangue"], ["Chocolat blanc"], ["Fruits rouges"], ["Caramel"]];
    const suggestions = ["Une création mangue-passion avec fruits frais", "Des formats découverte pour tester plusieurs saveurs", "Une glace coco avec des copeaux grillés", "Une création chocolat et noisette", "Des nouveautés inspirées des fruits locaux", "Une option avec moins de sauce"];
    return Array.from({ length: 24 }, (_, index) => ({
      flavors: flavors[index % flavors.length],
      mixes: mixes[index % mixes.length],
      toppings: toppings[index % toppings.length],
      sauces: sauces[index % sauces.length],
      suggestion: index % 4 === 0 ? suggestions[index % suggestions.length] : "",
      submittedAt: new Date(Date.now() - (23 - index) * 36e5 * 8).toISOString(),
    }));
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  const savedKey = sessionStorage.getItem("iceblue_admin_key");
  if (savedKey && isConfigured) openLiveDashboard(savedKey);
})();
