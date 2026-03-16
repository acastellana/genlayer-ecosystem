"use client";

import { useEffect, useRef, useCallback } from "react";
import type { EcosystemGraph, EcosystemNode } from "@/lib/types/graph";

const BASE_PATH = "/genlayer-ecosystem";

interface Props {
  graph: EcosystemGraph;
  onNodeClick: (node: EcosystemNode) => void;
  onAddProject: () => void;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function segmentHitsCircle(
  x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, r: number
): boolean {
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
  return t2 > 0.06 && t1 < 0.94;
}

// ─────────────────────────────────────────────────────────────────────────────

export function EcosystemStage({ graph, onNodeClick, onAddProject }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesLayerRef = useRef<HTMLDivElement>(null);

  // Refs for mutable state that shouldn't trigger re-renders
  const nodeElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const edgeElementsRef = useRef<{ path: SVGPathElement; label: SVGTextElement; edge: any; isBidi: boolean; side: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3;

  const getScale = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return 1;
    const r = stage.getBoundingClientRect();
    const raw = Math.min(r.width / 1200, r.height / 700);
    const floor = r.width < 640 ? 0.48 : 0.28;
    return Math.min(Math.max(raw, floor), 1.6);
  }, []);

  const applyCamera = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { x, y, zoom } = cameraRef.current;
    vp.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  }, []);

  const fitCamera = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !graph) return;
    const r = stage.getBoundingClientRect();
    if (r.width >= 880) return;

    const xs = graph.nodes.map((n) => n.position.x / 100);
    const ys = graph.nodes.map((n) => n.position.y / 100);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const clusterW = (maxX - minX) * r.width;
    const clusterH = (maxY - minY) * r.height;
    const clusterCX = ((minX + maxX) / 2) * r.width;
    const clusterCY = ((minY + maxY) / 2) * r.height;

    const safeTop = r.width < 640 ? 80 : 60;
    const safeBottom = r.width < 640 ? 80 : 60;
    const safeSide = r.width < 640 ? 24 : 32;
    const usableW = r.width - safeSide * 2;
    const usableH = r.height - safeTop - safeBottom;
    const pad = getScale() * 100;
    const zoom = Math.min(usableW / (clusterW + pad * 2), usableH / (clusterH + pad * 2));
    const clampedZoom = Math.min(Math.max(zoom, ZOOM_MIN), 1.05);

    cameraRef.current.zoom = clampedZoom;
    cameraRef.current.x = safeSide + usableW / 2 - clusterCX * clampedZoom;
    cameraRef.current.y = safeTop + usableH / 2 - clusterCY * clampedZoom;
    applyCamera();
  }, [graph, getScale, applyCamera]);

  // Build SVG markers
  const defineMarkers = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
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
    svg.appendChild(defs);
  }, []);

  const buildEdgeElements = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !graph) return;
    svg.innerHTML = "";
    defineMarkers();
    edgeElementsRef.current = [];

    const pairKey = (a: string, b: string) => [a, b].sort().join("||");
    const pairCount: Record<string, number> = {};
    const pairSeen: Record<string, number> = {};
    graph.edges.forEach((edge) => {
      const key = pairKey(edge.source, edge.target);
      pairCount[key] = (pairCount[key] || 0) + 1;
      pairSeen[key] = 0;
    });

    graph.edges.forEach((edge) => {
      const key = pairKey(edge.source, edge.target);
      const isBidi = pairCount[key] > 1;
      const side = isBidi ? (pairSeen[key] === 0 ? 1 : -1) : 0;
      pairSeen[key]++;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "connection-path");
      path.setAttribute("marker-end", "url(#arrowhead)");
      svg.appendChild(path);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "connection-label");
      label.setAttribute("text-anchor", "middle");
      label.textContent = edge.label;
      svg.appendChild(label);

      edgeElementsRef.current.push({ path, label, edge, isBidi, side });
    });
  }, [graph, defineMarkers]);

  const updateEdgePositions = useCallback(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg || !graph) return;

    const stageRect = stage.getBoundingClientRect();
    const W = stageRect.width;
    const H = stageRect.height;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const toSVG = (sx: number, sy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = sx; pt.y = sy;
      const ctm = svg.getScreenCTM();
      return ctm ? pt.matrixTransform(ctm.inverse()) : { x: sx - stageRect.left, y: sy - stageRect.top };
    };

    const liveCenter = (nodeId: string) => {
      const el = nodeElementsRef.current.get(nodeId);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return toSVG(r.left + r.width / 2, r.top + r.height / 2);
    };

    const scale = getScale();
    const getNodeById = (id: string) => graph.nodes.find((n) => n.id === id);

    edgeElementsRef.current.forEach(({ path, label, edge, isBidi, side }) => {
      const source = getNodeById(edge.source);
      const target = getNodeById(edge.target);
      if (!source || !target) return;

      const c1 = liveCenter(edge.source);
      const c2 = liveCenter(edge.target);
      if (!c1 || !c2) return;

      const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y) || 1;
      const ux = (c2.x - c1.x) / dist;
      const uy = (c2.y - c1.y) / dist;

      const [cSrcId, cTgtId] = [edge.source, edge.target].sort();
      const cc1 = liveCenter(cSrcId) || c1;
      const cc2 = liveCenter(cTgtId) || c2;
      const cdist = Math.hypot(cc2.x - cc1.x, cc2.y - cc1.y) || 1;
      const px = -(cc2.y - cc1.y) / cdist;
      const py = (cc2.x - cc1.x) / cdist;

      const margin = 12 * scale;
      const lateral = isBidi ? 18 * scale : 0;
      const r1 = (source.size / 2) * scale + margin;
      const r2 = (target.size / 2) * scale + margin;
      const x1 = c1.x + ux * r1 + px * lateral * side;
      const y1 = c1.y + uy * r1 + py * lateral * side;
      const x2 = c2.x - ux * r2 + px * lateral * side;
      const y2 = c2.y - uy * r2 + py * lateral * side;

      const clearance = 18 * scale;
      let arcSide = isBidi ? side : 1;
      let extraCurve = 0;
      graph.nodes.forEach((node) => {
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
  }, [graph, getScale]);

  // Main render: build all node DOM elements
  const renderNodes = useCallback(() => {
    const nodesLayer = nodesLayerRef.current;
    if (!nodesLayer || !graph) return;

    nodeElementsRef.current.clear();
    nodesLayer.innerHTML = "";

    const scale = getScale();

    graph.nodes.forEach((node, index) => {
      const wrapper = document.createElement("article");
      wrapper.className = `node${node.id === "genlayer" ? " is-center" : ""}`;
      wrapper.dataset.nodeId = node.id;
      wrapper.style.setProperty("--x", `${node.position.x}%`);
      wrapper.style.setProperty("--y", `${node.position.y}%`);
      wrapper.style.setProperty("--bubble-size", `${Math.round(node.size * scale)}px`);
      wrapper.style.setProperty("--delay", `${(index % 6) * 0.55}s`);
      wrapper.style.setProperty("--float-duration", `${8.2 + (index % 5) * 1.1}s`);
      wrapper.style.setProperty("--float-distance", `${Math.round((9 + (index % 4) * 2) * scale)}px`);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "node-button";
      button.setAttribute("aria-label", `Open details for ${node.name}`);
      button.addEventListener("click", () => onNodeClick(node));

      const img = document.createElement("img");
      img.className = "node-logo";
      img.src = `${BASE_PATH}/${node.logo}`;
      img.alt = `${node.name} logo`;

      const label = document.createElement("span");
      label.className = "node-label";
      label.textContent = node.name;

      if (node.status) {
        const badge = document.createElement("span");
        badge.className = `node-status status-${node.status.toLowerCase().replace(/\s+/g, "-")}`;
        badge.textContent = node.status;
        button.append(img, label, badge);
      } else {
        button.append(img, label);
      }

      wrapper.append(button);
      nodeElementsRef.current.set(node.id, wrapper);
      nodesLayer.appendChild(wrapper);
    });
  }, [graph, getScale, onNodeClick]);

  // Edge animation loop
  const startEdgeLoop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const loop = () => {
      updateEdgePositions();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [updateEdgePositions]);

  // Pan/Zoom binding
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const camera = cameraRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.zoom * delta));
      camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
      camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
      camera.zoom = newZoom;
      applyCamera();
    };

    let dragging = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = camera.x; startPanY = camera.y;
      stage.classList.add("is-dragging");
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      camera.x = startPanX + (e.clientX - startX);
      camera.y = startPanY + (e.clientY - startY);
      applyCamera();
    };

    const onMouseUp = () => {
      dragging = false;
      stage.classList.remove("is-dragging");
    };

    let lastTouches: TouchList | null = null;

    const onTouchStart = (e: TouchEvent) => { lastTouches = e.touches; };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touches = e.touches;
      if (touches.length === 1 && lastTouches?.length === 1) {
        camera.x += touches[0].clientX - lastTouches[0].clientX;
        camera.y += touches[0].clientY - lastTouches[0].clientY;
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
    };

    const onTouchEnd = () => { lastTouches = null; };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyCamera]);

  // Render nodes + edges on graph change
  useEffect(() => {
    if (!graph) return;
    renderNodes();
    buildEdgeElements();
    startEdgeLoop();
    fitCamera();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [graph, renderNodes, buildEdgeElements, startEdgeLoop, fitCamera]);

  // Keyboard + resize
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onNodeClick(null as any); // signal close
    };

    let resizeFrame: number | null = null;
    const onResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        renderNodes();
        buildEdgeElements();
        fitCamera();
      });
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [onNodeClick, renderNodes, buildEdgeElements, fitCamera]);

  return (
    <div className="ecosystem-stage" ref={stageRef}>
      <div className="noise" />
      <div className="center-glow" />

      {/* Masthead */}
      <header className="masthead">
        <p className="eyebrow">Interactive Map</p>
        <h1>
          {graph.meta?.title ?? "GenLayer"}<br />
          Ecosystem
        </h1>
      </header>

      {/* Viewport: pan/zoom root */}
      <div className="viewport" ref={viewportRef}>
        <svg
          ref={svgRef}
          className="connections"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        />
        <div className="nodes" ref={nodesLayerRef} />
      </div>

      {/* Bottom toolbar */}
      <div className="bottom-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            const glNode = graph.nodes.find((n) => n.id === "genlayer");
            if (glNode) onNodeClick(glNode);
          }}
        >
          Focus GenLayer
        </button>
        <button
          className="add-project-button"
          type="button"
          onClick={onAddProject}
        >
          + Add your project
        </button>
      </div>
    </div>
  );
}
