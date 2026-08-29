const apiStatus = document.querySelector("#api-status");
const apiDot = document.querySelector("#api-dot");
const agentList = document.querySelector("#agent-list");
const marketSource = document.querySelector("#market-source");
const sessionForm = document.querySelector("#session-form");
const verifyForm = document.querySelector("#verify-form");
const agentDetail = document.querySelector("#agent-detail");
const agentScrollSentinel = document.querySelector("#agent-scroll-sentinel");
const agentScrollStatus = document.querySelector("#agent-scroll-status");
const connectWalletButton = document.querySelector("#connect-wallet");
const walletStatus = document.querySelector("#wallet-status");

const state = {
  category: "",
  search: "",
  sort: "quality",
  selectedAgent: null,
  agentRequest: null,
  latestDigest: null,
  inspectedAgent: null,
  detailTrigger: null,
  agentOffset: 0,
  agentTotal: 0,
  hasMoreAgents: true,
  isLoadingAgents: false,
  agentQueryVersion: 0,
  agentNames: new Set(),
  agentCards: [],
};
const views = ["home", "agents", "control", "verify"];

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = String(text);
  return result;
}

function replaceWithMessage(container, className, title, copy) {
  const wrapper = element("div", className);
  wrapper.append(element("strong", "", title), element("p", "", copy));
  container.replaceChildren(wrapper);
}

function setButtonPending(button, pending, pendingLabel, readyLabel) {
  button.disabled = pending;
  button.firstChild.textContent = pending ? pendingLabel : readyLabel;
  button.setAttribute("aria-busy", pending ? "true" : "false");
}

async function requestJson(url, options = {}) {
  const controller = options.controller ?? new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      ...options,
      controller: undefined,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message ?? `Request failed with HTTP ${response.status}.`;
      throw new Error(message);
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function truncate(value, start = 7, end = 5) {
  if (!value || value.length <= start + end + 2) return value ?? "Unavailable";
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function formatMetric(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
}

function activateView(view, { focus = false } = {}) {
  const targetPanel = document.querySelector(`[data-panel="${view}"]`);
  if (!targetPanel) return;
  const navView = view === "control" ? "agents" : view;
  const targetTab = document.querySelector(`[data-view="${navView}"]`);

  document.body.classList.toggle("is-landing", view === "home");

  document.querySelectorAll("[data-view]").forEach((tab) => {
    const active = tab === targetTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel !== targetPanel;
  });

  history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (focus) targetTab?.focus();
}

document.querySelectorAll("[data-view]").forEach((tab) => {
  tab.addEventListener("click", () => activateView(tab.dataset.view));
  tab.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll("[data-view]")];
    const index = tabs.indexOf(tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    activateView(next.dataset.view, { focus: true });
  });
});

document.querySelectorAll("[data-go-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.goView));
});

window.addEventListener("hashchange", () => {
  const view = location.hash.slice(1);
  if (views.includes(view)) activateView(view);
});

async function loadHealth() {
  try {
    const health = await requestJson("/healthz");
    apiDot.className = "api-dot is-live";
    apiStatus.textContent = `Live · ${String(health.revision).slice(0, 7)}`;
  } catch {
    apiDot.className = "api-dot is-down";
    apiStatus.textContent = "API unavailable";
  }
}

function metric(label, value) {
  const wrapper = element("div");
  wrapper.append(element("dt", "", label), element("dd", "", value));
  return wrapper;
}

function renderProtocols(protocols, supportsX402) {
  const wrapper = element("div", "protocol-list");
  const values = [...new Set([...(Array.isArray(protocols) ? protocols : []), ...(supportsX402 ? ["x402"] : [])])].slice(0, 3);
  if (!values.length) {
    wrapper.append(element("span", "protocol-tag", "No protocol claim"));
    return wrapper;
  }
  values.forEach((protocol) => wrapper.append(element("span", "protocol-tag", protocol)));
  return wrapper;
}

function selectAgent(agent) {
  state.selectedAgent = { id: agent.id, name: agent.name };
  document.querySelector("#selected-agent-name").textContent = `${agent.name} · ${truncate(agent.id, 10, 5)}`;
  document.querySelector("#selected-agent").hidden = false;
  activateView("control");
}

function registryRow(label, value, { copyable = false } = {}) {
  const row = element("div");
  const definition = element("dd");
  if (copyable) {
    definition.className = "registry-copy-value";
    definition.append(element("code", "", value));
    const copyButton = element("button", "copy-registry-value", "[COPY]");
    copyButton.type = "button";
    copyButton.dataset.copyValue = value;
    copyButton.setAttribute("aria-label", `Copy ${label}`);
    definition.append(copyButton);
  } else {
    definition.textContent = value;
  }
  row.append(element("dt", "", label), definition);
  return row;
}

function openAgentDetail(agent, index, trigger) {
  state.inspectedAgent = agent;
  state.detailTrigger = trigger;

  document.querySelector("#agent-detail-index").textContent = String(index + 1).padStart(2, "0");
  const evidence = document.querySelector("#agent-detail-evidence");
  evidence.textContent = agent.evidence.endpointVerified ? "Endpoint verified" : "Registry evidence";
  evidence.classList.toggle("is-verified", Boolean(agent.evidence.endpointVerified));
  document.querySelector("#agent-detail-title").textContent = agent.name || `Agent ${agent.tokenId}`;
  document.querySelector("#agent-detail-description").textContent =
    agent.description || "No publisher description is available for this live identity.";

  document.querySelector("#agent-detail-metrics").replaceChildren(
    metric("Quality", formatMetric(agent.evidence.score)),
    metric("Feedback", formatMetric(agent.evidence.feedbackCount)),
    metric("Average", formatMetric(agent.evidence.averageFeedback, "%")),
    metric("Stars", formatMetric(agent.evidence.stars)),
  );
  document.querySelector("#agent-detail-registry").replaceChildren(
    registryRow("Agent ID", agent.id || "Unavailable", { copyable: Boolean(agent.id) }),
    registryRow("Owner", agent.owner || "Unavailable", { copyable: Boolean(agent.owner) }),
    registryRow("Registry", agent.registry || "Unavailable", { copyable: Boolean(agent.registry) }),
    registryRow("Chain", agent.evidence.bscMainnet ? "BNB Smart Chain · 56" : String(agent.chainId ?? "Unknown")),
    registryRow("Updated", agent.evidence.observedUpdatedAt ? new Date(agent.evidence.observedUpdatedAt).toLocaleString() : "Unavailable"),
    registryRow("Payments", agent.payments.x402 ? "x402 declared" : "No x402 claim"),
  );
  const protocols = renderProtocols(agent.protocols, agent.payments.x402);
  document.querySelector("#agent-detail-protocols").replaceChildren(...protocols.childNodes);

  agentDetail.classList.remove("is-opening");
  agentDetail.showModal();
  window.requestAnimationFrame(() => agentDetail.classList.add("is-opening"));
}

document.querySelector("#agent-detail-close").addEventListener("click", () => agentDetail.close());
agentDetail.addEventListener("click", (event) => {
  if (event.target === agentDetail) agentDetail.close();
});
agentDetail.addEventListener("close", () => {
  agentDetail.classList.remove("is-opening");
  state.detailTrigger?.focus();
  state.detailTrigger = null;
});
document.querySelector("#agent-detail-registry").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-value]");
  if (!button) return;
  const copyStatus = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText(button.dataset.copyValue);
    button.textContent = "[COPIED]";
    copyStatus.textContent = `${button.getAttribute("aria-label").replace("Copy ", "")} copied.`;
  } catch {
    copyStatus.textContent = "Copy is unavailable in this browser.";
  }
  window.setTimeout(() => {
    button.textContent = "[COPY]";
    copyStatus.textContent = "";
  }, 1_600);
});
document.querySelector("#agent-detail-limits").addEventListener("click", () => {
  if (!state.inspectedAgent) return;
  const agent = state.inspectedAgent;
  agentDetail.close();
  selectAgent(agent);
});

document.querySelector("#clear-selected-agent").addEventListener("click", () => {
  state.selectedAgent = null;
  document.querySelector("#selected-agent").hidden = true;
  document.querySelector("#selected-agent-name").textContent = "";
});

function agentCard(agent, index) {
  const card = element("article", "agent-card");
  card.style.setProperty("--card-delay", `${Math.min(index, 8) * 45}ms`);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-label", `View details for ${agent.name || `Agent ${agent.tokenId}`}`);
  const head = element("div", "agent-card-head");
  const evidence = element(
    "span",
    `evidence-state${agent.evidence.endpointVerified ? " is-verified" : ""}`,
    agent.evidence.endpointVerified ? "Endpoint verified" : "Registry evidence",
  );
  head.append(element("span", "agent-index", String(index + 1).padStart(2, "0")), evidence);

  const title = element("h3", "", agent.name || `Agent ${agent.tokenId}`);
  const description = element(
    "p",
    "agent-description",
    agent.description || "No publisher description is available for this live identity.",
  );
  const metrics = element("dl", "agent-metrics");
  metrics.append(
    metric("Quality", formatMetric(agent.evidence.score)),
    metric("Feedback", formatMetric(agent.evidence.feedbackCount)),
    metric("Average", formatMetric(agent.evidence.averageFeedback, "%")),
  );

  const footer = element("div", "agent-footer");
  footer.append(renderProtocols(agent.protocols, agent.payments.x402), element("span", "agent-open-label", "View agent"));

  const open = () => openAgentDetail(agent, index, card);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  });

  card.append(head, title, description, metrics, footer);
  return card;
}

function categoryLabel() {
  const active = document.querySelector("[data-category].is-active");
  if (!active?.dataset.category) return "agents";
  return active.textContent.trim().toLocaleLowerCase();
}

function updateAgentScrollStatus() {
  if (state.isLoadingAgents && state.agentCards.length) {
    agentScrollStatus.textContent = `Loading more ${categoryLabel()}…`;
    return;
  }
  if (!state.hasMoreAgents && state.agentCards.length) {
    agentScrollStatus.textContent = `All ${state.agentCards.length} available ${categoryLabel()} shown.`;
    return;
  }
  agentScrollStatus.textContent = "";
}

function revealAgentCards(cards) {
  window.requestAnimationFrame(() => cards.forEach((card) => card.classList.add("is-visible")));
}

async function loadAgents({ append = false } = {}) {
  if (append && (state.isLoadingAgents || !state.hasMoreAgents)) return;
  if (!append) {
    state.agentRequest?.abort();
    state.agentQueryVersion += 1;
  }
  const queryVersion = state.agentQueryVersion;
  const controller = new AbortController();
  state.agentRequest = controller;
  state.isLoadingAgents = true;
  agentList.setAttribute("aria-busy", "true");
  if (!append) {
    state.agentOffset = 0;
    state.agentTotal = 0;
    state.hasMoreAgents = true;
    state.agentNames = new Set();
    state.agentCards = [];
    agentList.replaceChildren(...Array.from({ length: 3 }, () => element("article", "agent-skeleton")));
  }
  updateAgentScrollStatus();

  try {
    const newItems = [];
    let observedAt = null;
    let pagesScanned = 0;

    while (state.hasMoreAgents && newItems.length === 0 && pagesScanned < 4) {
      const params = new URLSearchParams({ limit: "12", offset: String(state.agentOffset), sort: state.sort });
      if (state.category) params.set("category", state.category);
      if (state.search) params.set("q", state.search);

      const result = await requestJson(`/v1/agents?${params}`, { controller });
      if (controller.signal.aborted || queryVersion !== state.agentQueryVersion) return;
      const rawItems = Array.isArray(result.items) ? result.items : [];
      const uniqueItems = [...new Map(rawItems.map((item) => [item.id, item])).values()];
      uniqueItems.forEach((item) => {
        const normalizedName = item.name?.trim().toLocaleLowerCase();
        const key = normalizedName || item.id;
        if (state.agentNames.has(key)) return;
        state.agentNames.add(key);
        newItems.push(item);
      });
      state.agentOffset += rawItems.length;
      state.agentTotal = result.page.total;
      state.hasMoreAgents = rawItems.length > 0 && state.agentOffset < result.page.total;
      observedAt = result.source.observedAt;
      pagesScanned += 1;
    }

    const startIndex = state.agentCards.length;
    state.agentCards.push(...newItems);
    const observedCopy = observedAt
      ? ` · observed ${new Date(observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "";
    marketSource.textContent = `Showing ${state.agentCards.length} unique agents from ${state.agentOffset.toLocaleString()} checked registry records · ${state.agentTotal.toLocaleString()} matching BSC mainnet identities${observedCopy}`;
    if (!state.agentCards.length) {
      replaceWithMessage(
        agentList,
        "agent-empty",
        "No live agents match these filters.",
        "Try a broader category or remove the search term.",
      );
      state.hasMoreAgents = false;
      return;
    }
    const cards = newItems.map((agent, index) => agentCard(agent, startIndex + index));
    if (append) agentList.append(...cards);
    else agentList.replaceChildren(...cards);
    revealAgentCards(cards);
  } catch (error) {
    if (controller.signal.aborted) return;
    marketSource.textContent = "Live discovery source unavailable.";
    replaceWithMessage(
      agentList,
      "agent-error",
      "Agent discovery could not be completed.",
      error instanceof Error ? error.message : "The live source did not respond.",
    );
    state.hasMoreAgents = false;
  } finally {
    if (!controller.signal.aborted && queryVersion === state.agentQueryVersion) {
      state.isLoadingAgents = false;
      agentList.setAttribute("aria-busy", "false");
      updateAgentScrollStatus();
    }
  }
}

function setupAgentInfiniteScroll() {
  if (!("IntersectionObserver" in window)) {
    window.addEventListener(
      "scroll",
      () => {
        if (agentScrollSentinel.getBoundingClientRect().top < window.innerHeight + 500) {
          loadAgents({ append: true });
        }
      },
      { passive: true },
    );
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadAgents({ append: true });
    },
    { rootMargin: "500px 0px" },
  );
  observer.observe(agentScrollSentinel);
}

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.category = button.dataset.category;
    loadAgents();
  });
});

let searchTimer;
document.querySelector("#agent-search").addEventListener("input", (event) => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.search = event.target.value.trim();
    loadAgents();
  }, 350);
});

document.querySelector("#agent-sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  loadAgents();
});

document.querySelectorAll("[data-service-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.serviceFilter;
    const grid = document.querySelector(".service-grid");
    document.querySelectorAll("[data-service-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    grid.classList.add("is-switching");
    window.setTimeout(() => {
      document.querySelectorAll("[data-service-card]").forEach((card) => {
        const visible = filter === "all" || card.dataset.serviceCard === filter;
        card.classList.toggle("is-filtered-out", !visible);
      });
      window.requestAnimationFrame(() => grid.classList.remove("is-switching"));
    }, 150);
  });
});

function setupLandingMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = [...document.querySelectorAll("[data-reveal]")];
  const sections = [...document.querySelectorAll("[data-scroll-section]")];

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((target) => target.classList.add("is-visible"));
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8%" },
  );
  revealTargets.forEach((target) => revealObserver.observe(target));
  sections.forEach((section) => revealObserver.observe(section));

  let railFrame = 0;
  const updateSectionRail = () => {
    railFrame = 0;
    if (!document.body.classList.contains("is-landing")) return;
    const viewportTarget = window.innerHeight * 0.48;
    const active = sections.reduce((closest, section) => {
      const bounds = section.getBoundingClientRect();
      const distance = Math.abs(bounds.top + bounds.height * 0.5 - viewportTarget);
      return !closest || distance < closest.distance ? { section, distance } : closest;
    }, null)?.section;
    const activeNumber = active?.dataset.scrollSection;
    document.querySelectorAll("[data-section-link]").forEach((link) => {
      const selected = link.dataset.sectionLink === activeNumber;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };
  const scheduleSectionRail = () => {
    if (railFrame) return;
    railFrame = window.requestAnimationFrame(updateSectionRail);
  };
  window.addEventListener("scroll", scheduleSectionRail, { passive: true });
  window.addEventListener("resize", scheduleSectionRail, { passive: true });
  updateSectionRail();
}

function setDefaultExpiry() {
  const input = document.querySelector("#session-expiry");
  const now = new Date();
  const minimum = new Date(now.getTime() + 10 * 60 * 1_000);
  const defaultExpiry = new Date(now.getTime() + 60 * 60 * 1_000);
  const maximum = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const localValue = (date) => {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  input.min = localValue(minimum);
  input.max = localValue(maximum);
  input.value = localValue(defaultExpiry);
}

sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = document.querySelector("#session-error");
  const submit = document.querySelector("#session-submit");
  errorBox.hidden = true;

  if (!sessionForm.checkValidity()) {
    sessionForm.reportValidity();
    return;
  }

  const values = new FormData(sessionForm);
  const expiryValue = String(values.get("expiresAt"));
  const expiry = new Date(expiryValue);
  if (Number.isNaN(expiry.getTime())) {
    errorBox.textContent = "Choose a valid session expiry.";
    errorBox.hidden = false;
    return;
  }

  const payload = {
    walletAddress: String(values.get("walletAddress")).trim(),
    allowedCalls: [
      {
        target: String(values.get("target")).trim(),
        signature: String(values.get("signature")).trim(),
      },
    ],
    spend: {
      limitAtomicAmount: String(values.get("limitAtomicAmount")).trim(),
      period: String(values.get("period")),
    },
    expiresAt: expiry.toISOString(),
  };

  setButtonPending(submit, true, "Preparing…", "Prepare wallet approval");
  try {
    const result = await requestJson("/v1/altana/sessions/prepare", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.latestDigest = result.digest;
    document.querySelector("#session-empty").hidden = true;
    document.querySelector("#session-result").hidden = false;
    document.querySelector("#result-digest").textContent = result.digest;
    document.querySelector("#result-chain").textContent = `BNB Mainnet · ${result.payload.chainId}`;
    document.querySelector("#result-expiry").textContent = new Date(result.payload.expiry * 1_000).toLocaleString();
  } catch (error) {
    errorBox.textContent = error instanceof Error ? error.message : "The session draft could not be prepared.";
    errorBox.hidden = false;
  } finally {
    setButtonPending(submit, false, "Preparing…", "Prepare wallet approval");
  }
});

connectWalletButton?.addEventListener("click", async () => {
  walletStatus.textContent = "";
  const provider = window.ethereum;
  if (!provider?.request) {
    walletStatus.textContent = "Install or unlock an EVM wallet to connect.";
    return;
  }
  connectWalletButton.disabled = true;
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const wallet = accounts?.[0];
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet ?? "")) throw new Error("No wallet address was returned.");
    const chainId = await provider.request({ method: "eth_chainId" });
    document.querySelector("#session-wallet").value = wallet;
    if (String(chainId).toLowerCase() !== "0x61") {
      walletStatus.textContent = "Connected. Switch to BNB Mainnet (chain 56) before signing.";
    } else {
      walletStatus.textContent = "Connected on BNB Mainnet. Sakoso never receives your private key.";
    }
  } catch (error) {
    walletStatus.textContent = error instanceof Error ? error.message : "Wallet connection was cancelled.";
  } finally {
    connectWalletButton.disabled = false;
  }
});

document.querySelector("#copy-digest").addEventListener("click", async (event) => {
  if (!state.latestDigest) return;
  try {
    await navigator.clipboard.writeText(state.latestDigest);
    event.currentTarget.textContent = "Digest copied";
  } catch {
    event.currentTarget.textContent = "Copy unavailable";
  }
  window.setTimeout(() => {
    event.currentTarget.textContent = "Copy digest";
  }, 1_600);
});

function allowedExplorerUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!["explorer.altana.network", "bscscan.com"].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = document.querySelector("#verify-error");
  const submit = document.querySelector("#verify-submit");
  errorBox.hidden = true;

  if (!verifyForm.checkValidity()) {
    verifyForm.reportValidity();
    return;
  }

  const values = new FormData(verifyForm);
  const wallet = String(values.get("wallet")).trim();
  const publicKey = String(values.get("publicKey")).trim();
  if (!/^0x04[a-fA-F0-9]{128}$/.test(publicKey)) {
    errorBox.textContent = "Enter a 65-byte SEC1 public key beginning with 0x04. Private keys are not accepted.";
    errorBox.hidden = false;
    return;
  }

  setButtonPending(submit, true, "Reading KeyStore…", "Read KeyStore authority");
  try {
    const params = new URLSearchParams({ wallet, publicKey });
    const result = await requestJson(`/v1/altana/authority?${params}`);
    document.querySelector("#verify-empty").hidden = true;
    document.querySelector("#verify-result").hidden = false;

    const stateNode = document.querySelector("#authority-state");
    stateNode.className = `authority-state ${result.authorized ? "is-active" : "is-inactive"}`;
    stateNode.textContent = result.authorized ? "Active authority" : "No active authority";
    document.querySelector("#authority-title").textContent = result.authorized
      ? "This session key is authorized."
      : "This key is revoked or unregistered.";
    document.querySelector("#authority-copy").textContent = result.authorized
      ? "Altana’s KeyStore reports the key as valid for this wallet at the observed block."
      : "The KeyStore boolean proves the key is not currently valid; it does not distinguish a revoked key from one that was never registered.";
    document.querySelector("#authority-block").textContent = result.observedBlock;
    document.querySelector("#authority-key").textContent = truncate(result.keyId, 12, 10);
    document.querySelector("#authority-wallet").textContent = truncate(result.walletAddress, 12, 8);

    const accountLink = document.querySelector("#authority-account-link");
    const keyLink = document.querySelector("#authority-key-link");
    const safeAccount = allowedExplorerUrl(result.explorer.account);
    const safeKey = allowedExplorerUrl(result.explorer.key);
    accountLink.hidden = !safeAccount;
    keyLink.hidden = !safeKey;
    if (safeAccount) accountLink.href = safeAccount;
    if (safeKey) keyLink.href = safeKey;
  } catch (error) {
    errorBox.textContent = error instanceof Error ? error.message : "Authority could not be read.";
    errorBox.hidden = false;
  } finally {
    setButtonPending(submit, false, "Reading KeyStore…", "Read KeyStore authority");
  }
});

function createAuthorityField() {
  const canvas = document.querySelector("#authority-field");
  const context = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const draw = (time = 0) => {
    context.clearRect(0, 0, width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.48;
    const radius = Math.min(width, height) * 0.31;
    const rotation = (reducedMotion ? 0.35 : time * 0.00008) + pointerX * 0.16;
    const tilt = -0.17 + pointerY * 0.08;

    context.save();
    context.strokeStyle = "rgba(244,243,237,.18)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY, radius * 1.34, radius * 0.44, -0.12, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    for (let latitude = -1.42; latitude <= 1.42; latitude += 0.095) {
      const latitudeRadius = Math.cos(latitude);
      for (let longitude = 0; longitude < Math.PI * 2; longitude += 0.105) {
        const x = latitudeRadius * Math.cos(longitude);
        const y = Math.sin(latitude);
        const z = latitudeRadius * Math.sin(longitude);
        const rotatedX = x * Math.cos(rotation) - z * Math.sin(rotation);
        const rotatedZ = x * Math.sin(rotation) + z * Math.cos(rotation);
        const tiltedY = y * Math.cos(tilt) - rotatedZ * Math.sin(tilt);
        const depth = y * Math.sin(tilt) + rotatedZ * Math.cos(tilt);
        if (depth < -0.32) continue;

        const perspective = 1 + depth * 0.14;
        const px = centerX + rotatedX * radius * perspective;
        const py = centerY + tiltedY * radius * perspective;
        const alpha = 0.16 + Math.max(0, depth) * 0.68;
        const size = 0.65 + Math.max(0, depth) * 1.25;
        context.fillStyle = `rgba(244,243,237,${alpha})`;
        context.fillRect(px, py, size, size);
      }
    }

    const railY = centerY + radius * 0.03;
    const gradient = context.createLinearGradient(width * 0.08, railY, width * 0.94, railY);
    gradient.addColorStop(0, "rgba(244,243,237,0)");
    gradient.addColorStop(0.17, "rgba(244,243,237,.92)");
    gradient.addColorStop(0.76, "rgba(244,243,237,.78)");
    gradient.addColorStop(1, "rgba(244,243,237,0)");
    context.fillStyle = gradient;
    context.fillRect(width * 0.07, railY, width * 0.87, 1);
    context.beginPath();
    context.arc(width * 0.9, railY + 0.5, 3.2, 0, Math.PI * 2);
    context.fillStyle = "rgba(244,243,237,.95)";
    context.fill();

    if (!reducedMotion) requestAnimationFrame(draw);
  };

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
  });
  canvas.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
  });
  window.addEventListener("resize", resize, { passive: true });
  resize();
  draw();
}

setDefaultExpiry();
createAuthorityField();
setupLandingMotion();
setupAgentInfiniteScroll();
activateView(views.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home");
loadHealth();
loadAgents();
