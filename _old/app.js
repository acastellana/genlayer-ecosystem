const stage = document.getElementById("ecosystem-stage");
const viewport = document.getElementById("viewport");
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

// Live DOM element map: nodeId → wrapper article element
const nodeElements = new Map();
// Pre-created SVG elements for each edge (updated every frame)
const edgeElements = [];
// rAF handle
let animFrameId = null;

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

import { getPlayers, submitPlayer, hasWallet, EXPLORER_TX } from "./chain.js";

const loadGraph = async () => {
  return getPlayers(import.meta.env.BASE_URL + "ecosystem.json");
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

  // Status badge in panel
  let panelStatus = document.getElementById("panel-status");
  if (!panelStatus) {
    panelStatus = createElement("span", "");
    panelStatus.id = "panel-status";
    panelRefs.title.insertAdjacentElement("afterend", panelStatus);
  }
  if (node.status) {
    panelStatus.className = `panel-status-badge status-${node.status.toLowerCase().replace(/\s+/g, "-")}`;
    panelStatus.textContent = node.status;
  } else {
    panelStatus.textContent = "";
    panelStatus.className = "";
  }
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

// Returns a scale factor based on current stage size vs. reference 1200×700 canvas
const getScale = () => {
  const r = stage.getBoundingClientRect();
  const raw = Math.min(r.width / 1200, r.height / 700);
  // On small screens (mobile) enforce a larger floor so bubbles stay legible and tappable
  const floor = r.width < 640 ? 0.48 : 0.28;
  return Math.min(Math.max(raw, floor), 1.6);
};

const buildNode = (node, index) => {
  const scale = getScale();
  const wrapper = createElement("article", `node${node.id === "genlayer" ? " is-center" : ""}`);
  wrapper.dataset.nodeId = node.id;
  wrapper.style.setProperty("--x", `${node.position.x}%`);
  wrapper.style.setProperty("--y", `${node.position.y}%`);
  wrapper.style.setProperty("--bubble-size", `${Math.round(node.size * scale)}px`);
  wrapper.style.setProperty("--delay", `${(index % 6) * 0.55}s`);
  wrapper.style.setProperty("--float-duration", `${8.2 + (index % 5) * 1.1}s`);
  wrapper.style.setProperty("--float-distance", `${Math.round((9 + (index % 4) * 2) * scale)}px`);

  const button = createElement("button", "node-button");
  button.type = "button";
  button.setAttribute("aria-label", `Open details for ${node.name}`);
  button.addEventListener("click", () => openPanel(node.id));

  const img = createElement("img", "node-logo");
  img.src = import.meta.env.BASE_URL + node.logo;
  img.alt = `${node.name} logo`;

  const label = createElement("span", "node-label", node.name);
  if (node.status) {
    const badge = createElement("span", `node-status status-${node.status.toLowerCase().replace(/\s+/g, "-")}`, node.status);
    button.append(img, label, badge);
  } else {
    button.append(img, label);
  }

  wrapper.append(button);

  nodeElements.set(node.id, wrapper);
  return wrapper;
};

// ── Obstacle avoidance ────────────────────────────────────────────────────────

// Does segment (x1,y1)→(x2,y2) intersect circle at (cx,cy) with radius r?
const segmentHitsCircle = (x1, y1, x2, y2, cx, cy, r) => {
  const dx = x2 - x1, dy = y2 - y1;
  const fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1) return false;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  // Only counts if intersection is within the segment (with small end tolerance)
  return t2 > 0.06 && t1 < 0.94;
};

// Given that segment (x1,y1)→(x2,y2) passes through circle (cx,cy,r),
// return a waypoint that routes around it on the shorter side.
const waypointAroundCircle = (x1, y1, x2, y2, cx, cy, r) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  // Project circle center onto segment
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  // Direction from circle center to nearest point
  let nx = nearX - cx, ny = nearY - cy;
  const nl = Math.hypot(nx, ny);
  if (nl < 1) { nx = -dy / Math.sqrt(len2); ny = dx / Math.sqrt(len2); } // line through center
  else { nx /= nl; ny /= nl; }
  return { t, x: cx + nx * r, y: cy + ny * r };
};

// Smooth SVG path through an ordered array of {x,y} points
const smoothPath = (pts) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return d + ` L ${pts[1].x} ${pts[1].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q ${pts[i].x} ${pts[i].y} ${mid.x} ${mid.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
};

// ─────────────────────────────────────────────────────────────────────────────

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

// Phase 1: create SVG elements for each edge (called once on render)
const buildEdgeElements = () => {
  connectionsSvg.innerHTML = "";
  defineMarkers();
  edgeElements.length = 0;

  const pairKey = (a, b) => [a, b].sort().join("||");
  const pairCount = {};
  const pairSeen = {};
  state.graph.edges.forEach((edge) => {
    const key = pairKey(edge.source, edge.target);
    pairCount[key] = (pairCount[key] || 0) + 1;
    pairSeen[key] = 0;
  });

  state.graph.edges.forEach((edge) => {
    const key = pairKey(edge.source, edge.target);
    const isBidi = pairCount[key] > 1;
    const side = isBidi ? (pairSeen[key] === 0 ? 1 : -1) : 0;
    pairSeen[key]++;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "connection-path");
    path.setAttribute("marker-end", "url(#arrowhead)");
    connectionsSvg.appendChild(path);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "connection-label");
    label.setAttribute("text-anchor", "middle");
    label.textContent = edge.label;
    connectionsSvg.appendChild(label);

    edgeElements.push({ path, label, edge, isBidi, side });
  });
};

// Phase 2: update path geometry from live DOM positions (called every rAF frame)
const updateEdgePositions = () => {
  const stageRect = stage.getBoundingClientRect();
  const W = stageRect.width;
  const H = stageRect.height;
  connectionsSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Helper: screen coords → SVG local coords (accounts for viewport pan/zoom)
  const toSVG = (sx, sy) => {
    const pt = connectionsSvg.createSVGPoint();
    pt.x = sx; pt.y = sy;
    const ctm = connectionsSvg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: sx - stageRect.left, y: sy - stageRect.top };
  };

  // Get live center of a node in SVG coords
  const liveCenter = (nodeId) => {
    const el = nodeElements.get(nodeId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return toSVG(r.left + r.width / 2, r.top + r.height / 2);
  };

  const scale = getScale();

  edgeElements.forEach(({ path, label, edge, isBidi, side }) => {
    const source = getNodeById(edge.source);
    const target = getNodeById(edge.target);
    if (!source || !target) return;

    const c1 = liveCenter(edge.source);
    const c2 = liveCenter(edge.target);
    if (!c1 || !c2) return;

    const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y) || 1;
    const ux = (c2.x - c1.x) / dist;
    const uy = (c2.y - c1.y) / dist;

    // Canonical perpendicular (sorted pair direction, stable across bidi)
    const [cSrcId, cTgtId] = [edge.source, edge.target].sort();
    const cc1 = liveCenter(cSrcId) || c1;
    const cc2 = liveCenter(cTgtId) || c2;
    const cdist = Math.hypot(cc2.x - cc1.x, cc2.y - cc1.y) || 1;
    const px = -(cc2.y - cc1.y) / cdist;
    const py =  (cc2.x - cc1.x) / cdist;

    const margin = 12 * scale;
    const lateral = isBidi ? 18 * scale : 0;
    const r1 = (source.size / 2) * scale + margin;
    const r2 = (target.size / 2) * scale + margin;
    const x1 = c1.x + ux * r1 + px * lateral * side;
    const y1 = c1.y + uy * r1 + py * lateral * side;
    const x2 = c2.x - ux * r2 + px * lateral * side;
    const y2 = c2.y - uy * r2 + py * lateral * side;

    // Obstacle avoidance using live positions
    const clearance = 18 * scale;
    let arcSide = isBidi ? side : 1;
    let extraCurve = 0;
    state.graph.nodes.forEach((node) => {
      if (node.id === edge.source || node.id === edge.target) return;
      const oc = liveCenter(node.id);
      if (!oc) return;
      const r = (node.size / 2) * scale + clearance;
      if (!segmentHitsCircle(c1.x, c1.y, c2.x, c2.y, oc.x, oc.y, r)) return;
      const dot = (oc.x - c1.x) * px + (oc.y - c1.y) * py;
      if (!isBidi) arcSide = dot > 0 ? -1 : 1;
      const t = ((oc.x - c1.x) * (c2.x - c1.x) + (oc.y - c1.y) * (c2.y - c1.y)) / (dist * dist);
      const nearX = c1.x + t * (c2.x - c1.x);
      const nearY = c1.y + t * (c2.y - c1.y);
      extraCurve = Math.max(extraCurve, r - Math.hypot(oc.x - nearX, oc.y - nearY) + 20 * scale);
    });

    const CURVE = (isBidi ? 70 * scale : Math.max(20 * scale, Math.min(80 * scale, dist * 0.15 + 20 * scale))) + extraCurve;
    const mx = (x1 + x2) / 2 + px * CURVE * arcSide;
    const my = (y1 + y2) / 2 + py * CURVE * arcSide;

    path.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my}, ${x2} ${y2}`);
    label.setAttribute("x", `${0.25 * x1 + 0.5 * mx + 0.25 * x2}`);
    label.setAttribute("y", `${0.25 * y1 + 0.5 * my + 0.25 * y2 - 7}`);
  });
};

// Animation loop — runs every frame so edges track the floating bubbles
const startEdgeLoop = () => {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  const loop = () => {
    updateEdgePositions();
    animFrameId = requestAnimationFrame(loop);
  };
  animFrameId = requestAnimationFrame(loop);
};

const drawConnections = () => {
  buildEdgeElements();
};

const render = () => {
  nodeElements.clear();
  nodesLayer.replaceChildren(...state.graph.nodes.map(buildNode));
  drawConnections();
  startEdgeLoop();
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
    resizeFrame = requestAnimationFrame(() => {
      render();
      fitCamera();
    });
  });

  // ── Submit modal ────────────────────────────────────────────────────────────
  const modal       = document.getElementById("submit-modal");
  const addBtn      = document.getElementById("add-project-btn");
  const closeBtn    = document.getElementById("submit-close");
  const backdrop    = document.getElementById("submit-backdrop");
  const submitBtn   = document.getElementById("submit-btn");
  const urlInput    = document.getElementById("submit-url");
  const statusEl    = document.getElementById("submit-status");

  const openModal  = () => { modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); urlInput.focus(); };
  const closeModal = () => { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); statusEl.textContent = ""; statusEl.className = "submit-status"; };

  addBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

  submitBtn.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) { setStatus("error", "Please enter a URL."); return; }
    try { new URL(url); } catch { setStatus("error", "Please enter a valid URL (include https://)."); return; }

    if (!hasWallet()) {
      setStatus("error", "No wallet detected. Install MetaMask to submit on-chain.");
      return;
    }

    submitBtn.disabled = true;
    setStatus("loading", "Connecting wallet…");

    try {
      setStatus("loading", "Waiting for wallet confirmation…");
      const txHash = await submitPlayer(url);
      setStatus("success",
        `Submitted! The AI jury is evaluating your project. ` +
        `<a href="${EXPLORER_TX(txHash)}" target="_blank" rel="noopener">View on explorer ↗</a>`
      );
      urlInput.value = "";
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("4001")) {
        setStatus("error", "Transaction cancelled.");
      } else {
        setStatus("error", `Error: ${msg.slice(0, 120)}`);
      }
    } finally {
      submitBtn.disabled = false;
    }
  });

  function setStatus(type, html) {
    statusEl.className = `submit-status submit-status--${type}`;
    statusEl.innerHTML = html;
  }
};

// ── Pan / zoom ────────────────────────────────────────────────────────────────

const camera = { x: 0, y: 0, zoom: 1 };
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

const applyCamera = () => {
  viewport.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
};

const bindPanZoom = () => {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let dragMoved = false;

  // Wheel → zoom around cursor
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.zoom * delta));
    // Adjust pan so zoom is anchored at cursor
    camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
    camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
    camera.zoom = newZoom;
    applyCamera();
  }, { passive: false });

  // Mouse drag → pan
  stage.addEventListener("mousedown", (e) => {
    // Don't initiate drag from buttons/links
    if (e.target.closest("button, a")) return;
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = camera.x;
    startPanY = camera.y;
    stage.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    camera.x = startPanX + dx;
    camera.y = startPanY + dy;
    applyCamera();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    stage.classList.remove("is-dragging");
  });

  // Touch: single finger pan, pinch zoom
  let lastTouches = null;

  stage.addEventListener("touchstart", (e) => {
    lastTouches = e.touches;
  }, { passive: true });

  stage.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1 && lastTouches?.length === 1) {
      const dx = touches[0].clientX - lastTouches[0].clientX;
      const dy = touches[0].clientY - lastTouches[0].clientY;
      camera.x += dx;
      camera.y += dy;
      applyCamera();
    } else if (touches.length === 2 && lastTouches?.length === 2) {
      const prevDist = Math.hypot(
        lastTouches[0].clientX - lastTouches[1].clientX,
        lastTouches[0].clientY - lastTouches[1].clientY
      );
      const newDist = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
      const delta = newDist / prevDist;
      const midX = (touches[0].clientX + touches[1].clientX) / 2;
      const midY = (touches[0].clientY + touches[1].clientY) / 2;
      const rect = stage.getBoundingClientRect();
      const mx = midX - rect.left;
      const my = midY - rect.top;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.zoom * delta));
      camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
      camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
      camera.zoom = newZoom;
      applyCamera();
    }
    lastTouches = touches;
  }, { passive: false });

  stage.addEventListener("touchend", () => { lastTouches = null; }, { passive: true });
};

// ─────────────────────────────────────────────────────────────────────────────

// Fit camera so all nodes sit comfortably within the visible safe-zone.
// Reads actual node extents from state.graph so it stays correct as the data changes.
const fitCamera = () => {
  if (!state.graph) return;
  const r = stage.getBoundingClientRect();
  if (r.width >= 880) return; // desktop handles itself at zoom=1

  // Compute bounding box of node centres (in % of stage dimensions)
  const xs = state.graph.nodes.map((n) => n.position.x / 100);
  const ys = state.graph.nodes.map((n) => n.position.y / 100);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const clusterW = (maxX - minX) * r.width;
  const clusterH = (maxY - minY) * r.height;
  const clusterCX = ((minX + maxX) / 2) * r.width;
  const clusterCY = ((minY + maxY) / 2) * r.height;

  // Safe-zone insets (leave room for masthead top, buttons bottom)
  const safeTop    = r.width < 640 ? 80 : 60;
  const safeBottom = r.width < 640 ? 80 : 60;
  const safeSide   = r.width < 640 ? 24 : 32;
  const usableW = r.width  - safeSide * 2;
  const usableH = r.height - safeTop - safeBottom;

  // Padding around the cluster (bubble radius + breathing room)
  const pad = getScale() * 100;
  const zoom = Math.min(usableW / (clusterW + pad * 2), usableH / (clusterH + pad * 2));
  const clampedZoom = Math.min(Math.max(zoom, ZOOM_MIN), 1.05);

  const targetCX = safeSide + usableW / 2;
  const targetCY = safeTop  + usableH / 2;

  camera.zoom = clampedZoom;
  camera.x = targetCX - clusterCX * clampedZoom;
  camera.y = targetCY - clusterCY * clampedZoom;
  applyCamera();
};

const initialize = async () => {
  try {
    state.graph = await loadGraph();
    render();
    bindEvents();
    bindPanZoom();
    fitCamera();
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
