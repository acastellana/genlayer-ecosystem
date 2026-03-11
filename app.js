const stage = document.getElementById("ecosystem-stage");
const connectionsSvg = document.getElementById("connections");
const nodesLayer = document.getElementById("nodes");
const panel = document.getElementById("detail-panel");
const focusGenLayerButton = document.getElementById("focus-genlayer");

const panelRefs = {
  logo: document.getElementById("panel-logo"),
  type: document.getElementById("panel-type"),
  title: document.getElementById("panel-title"),
  tagline: document.getElementById("panel-tagline"),
  description: document.getElementById("panel-description"),
  tags: document.getElementById("panel-tags"),
  links: document.getElementById("panel-links"),
  relationships: document.getElementById("panel-relationships")
};

const state = {
  graph: null,
  activeNodeId: null
};

const createElement = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof content === "string") element.textContent = content;
  return element;
};

const loadGraph = async () => {
  const response = await fetch(import.meta.env.BASE_URL + "ecosystem.json");
  if (!response.ok) {
    throw new Error(`Failed to load graph data: ${response.status}`);
  }
  return response.json();
};

const getNodeById = (id) => state.graph.nodes.find((node) => node.id === id);

const getRelationships = (nodeId) => {
  return state.graph.edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => {
      const isOutgoing = edge.source === nodeId;
      const counterpart = getNodeById(isOutgoing ? edge.target : edge.source);
      return {
        direction: isOutgoing ? "Outgoing" : "Incoming",
        counterpart,
        label: edge.label,
        note: edge.note
      };
    });
};

const openPanel = (nodeId) => {
  state.activeNodeId = nodeId;
  const node = getNodeById(nodeId);
  if (!node) return;

  panelRefs.logo.src = import.meta.env.BASE_URL + node.logo;
  panelRefs.logo.alt = `${node.name} logo`;
  panelRefs.type.textContent = node.kind;
  panelRefs.title.textContent = node.name;
  panelRefs.tagline.textContent = node.tagline;
  panelRefs.description.textContent = node.description;

  panelRefs.tags.replaceChildren(
    ...(node.tags || []).map((tag) => createElement("div", "tag", tag))
  );

  panelRefs.links.replaceChildren(
    ...(node.links || []).map((link) => {
      const anchor = createElement("a", "link-card");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";

      const copy = createElement("div", "link-copy");
      copy.append(
        createElement("span", "link-label", link.label),
        createElement("span", "link-url", link.url)
      );

      anchor.append(copy, createElement("span", "link-arrow", "↗"));
      return anchor;
    })
  );

  const relationships = getRelationships(nodeId);
  panelRefs.relationships.replaceChildren(
    ...relationships.map((relationship) => {
      const item = createElement("div", "relationship-chip");
      const copy = createElement("div", "relationship-copy");
      copy.append(
        createElement(
          "span",
          "relationship-title",
          `${relationship.direction} · ${relationship.label} · ${relationship.counterpart.name}`
        ),
        createElement("span", "relationship-note", relationship.note)
      );
      item.append(copy, createElement("span", "relationship-arrow", "→"));
      return item;
    })
  );

  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  document.querySelectorAll(".node").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.nodeId === nodeId);
  });
};

const closePanel = () => {
  state.activeNodeId = null;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  document.querySelectorAll(".node").forEach((element) => {
    element.classList.remove("is-active");
  });
};

const buildNode = (node, index) => {
  const wrapper = createElement("article", `node${node.id === "genlayer" ? " is-center" : ""}`);
  wrapper.dataset.nodeId = node.id;
  wrapper.style.setProperty("--x", `${node.position.x}%`);
  wrapper.style.setProperty("--y", `${node.position.y}%`);
  wrapper.style.setProperty("--bubble-size", `${node.size}px`);
  wrapper.style.setProperty("--delay", `${(index % 6) * 0.55}s`);
  wrapper.style.setProperty("--float-duration", `${8.2 + (index % 5) * 1.1}s`);
  wrapper.style.setProperty("--float-distance", `${9 + (index % 4) * 2}px`);

  const button = createElement("button", "node-button");
  button.type = "button";
  button.setAttribute("aria-label", `Open details for ${node.name}`);
  button.addEventListener("click", () => openPanel(node.id));

  const img = createElement("img", "node-logo");
  img.src = import.meta.env.BASE_URL + node.logo;
  img.alt = `${node.name} logo`;

  const label = createElement("span", "node-label", node.name);

  button.append(img, label);
  wrapper.append(button);

  return wrapper;
};

const defineMarkers = () => {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "8");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("orient", "auto-start-reverse");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  path.setAttribute("fill", "rgba(17, 24, 39, 0.42)");
  marker.appendChild(path);
  defs.appendChild(marker);
  connectionsSvg.appendChild(defs);
};

const drawConnections = () => {
  connectionsSvg.innerHTML = "";
  defineMarkers();

  const stageRect = stage.getBoundingClientRect();
  const width = stageRect.width;
  const height = stageRect.height;

  connectionsSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  connectionsSvg.setAttribute("preserveAspectRatio", "none");

  state.graph.edges.forEach((edge) => {
    const source = getNodeById(edge.source);
    const target = getNodeById(edge.target);
    if (!source || !target) return;

    const x1 = (source.position.x / 100) * width;
    const y1 = (source.position.y / 100) * height;
    const x2 = (target.position.x / 100) * width;
    const y2 = (target.position.y / 100) * height;

    const dx = x2 - x1;
    const curve = Math.max(36, Math.min(110, Math.abs(dx) * 0.18 + 40));
    const cp1x = x1 + dx * 0.35;
    const cp1y = y1 + (y2 > y1 ? curve : -curve);
    const cp2x = x1 + dx * 0.7;
    const cp2y = y2 + (y2 > y1 ? -curve : curve);

    const pathDefinition = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathDefinition);
    path.setAttribute("class", "connection-path");
    path.setAttribute("marker-end", "url(#arrowhead)");
    connectionsSvg.appendChild(path);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "connection-label");
    label.setAttribute("x", `${(x1 + x2) / 2}`);
    label.setAttribute("y", `${(y1 + y2) / 2 - 10}`);
    label.setAttribute("text-anchor", "middle");
    label.textContent = edge.label;
    connectionsSvg.appendChild(label);
  });
};

const render = () => {
  nodesLayer.replaceChildren(...state.graph.nodes.map(buildNode));
  drawConnections();
};

const bindEvents = () => {
  panel.querySelectorAll("[data-close-panel]").forEach((element) => {
    element.addEventListener("click", closePanel);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  focusGenLayerButton.addEventListener("click", () => openPanel("genlayer"));

  let resizeFrame = null;
  window.addEventListener("resize", () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawConnections);
  });
};

const initialize = async () => {
  try {
    state.graph = await loadGraph();
    render();
    bindEvents();
  } catch (error) {
    console.error(error);
    const fallback = createElement(
      "div",
      "tag",
      "Could not load the GenLayer ecosystem map."
    );
    stage.replaceChildren(fallback);
  }
};

initialize();
