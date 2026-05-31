"use client";

import React, { useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

interface ReferralInfo {
  id: string;
  parent_id: string | null;
  email: string;
  investment_usdt: number;
  bonus_usdt: number;
  level: number;
}

const nodeWidth = 200;
const nodeHeight = 80;

// Create a fresh dagre graph each call to avoid stale nodes
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction });

  const isHorizontal = direction === "LR";

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const newNodes = nodes.map((node) => {
    const pos = graph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const CustomNode = ({ data }: any) => {
  const isActive = data.investment > 0;
  return (
    <div style={{
      background: data.isRoot
        ? "rgba(34,201,122,0.15)"
        : isActive
          ? "rgba(0,180,255,0.1)"
          : "rgba(80,80,80,0.15)",
      border: `1px solid ${data.isRoot
        ? "rgba(34,201,122,0.4)"
        : isActive
          ? "rgba(0,180,255,0.3)"
          : "rgba(120,120,120,0.3)"}`,
      borderRadius: 12,
      padding: "10px 14px",
      minWidth: 180,
      backdropFilter: "blur(12px)",
      color: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
    }}>
      <Handle type="target" position={Position.Top} style={{ background: "#4a6a9a" }} />
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, wordBreak: "break-all" }}>
        {data.email}
      </div>
      {!data.isRoot && (
        <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#4a6a9a" }}>L{data.level}</span>
          <span style={{ color: isActive ? "#fff" : "#666" }}>
            {isActive ? `$${data.investment?.toFixed(2)}` : "не активен"}
          </span>
        </div>
      )}
      {data.bonus > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", textAlign: "right", marginTop: 2 }}>
          +{data.bonus.toFixed(2)}$
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: "#4a6a9a" }} />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

// Build nodes and edges from referral data
function buildGraph(data: ReferralInfo[], rootEmail: string) {
  // Collect all IDs that are in data (to detect L1 referrals whose parent is the root)
  const dataIds = new Set(data.map(r => r.id));

  const nodes: Node[] = [
    {
      id: "root",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { email: rootEmail, isRoot: true },
    },
  ];

  const edges: Edge[] = [];

  data.forEach((ref) => {
    nodes.push({
      id: ref.id,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        email: ref.email,
        level: ref.level,
        investment: ref.investment_usdt,
        bonus: ref.bonus_usdt,
      },
    });

    // If parent_id is null OR parent is not in the data array → connect to root
    const parentInData = ref.parent_id && dataIds.has(ref.parent_id);
    const sourceId = parentInData ? ref.parent_id! : "root";
    const isActive = ref.investment_usdt > 0;

    edges.push({
      id: `e-${sourceId}-${ref.id}`,
      source: sourceId,
      target: ref.id,
      type: "smoothstep",
      animated: isActive,
      style: { stroke: isActive ? "#00cfff" : "#444", strokeWidth: isActive ? 2 : 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? "#00cfff" : "#444",
      },
    });
  });

  return { nodes, edges };
}

export default function ReferralNetwork({ data, rootEmail }: { data: ReferralInfo[], rootEmail: string }) {
  const [open, setOpen] = useState(false);

  const { nodes: initNodes, edges: initEdges } = buildGraph(data, rootEmail);
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initNodes, initEdges);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(data, rootEmail);
    const { nodes: ln, edges: le } = getLayoutedElements(n, e);
    setNodes(ln);
    setEdges(le);
  }, [data, rootEmail]);

  const totalRefs = data.length;
  const activeRefs = data.filter(r => r.investment_usdt > 0).length;
  const totalBonus = data.reduce((s, r) => s + r.bonus_usdt, 0);

  return (
    <div style={{ width: "100%" }}>
      {/* Header button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0,180,255,0.07)",
          border: "1px solid rgba(0,180,255,0.2)",
          borderRadius: open ? "12px 12px 0 0" : 12,
          padding: "10px 16px",
          cursor: "pointer",
          color: "#fff",
          transition: "border-radius 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Структура сети</span>
          <span style={{ fontSize: 11, color: "#4a6a9a" }}>
            {totalRefs} чел · {activeRefs} активных
            {totalBonus > 0 && ` · +${totalBonus.toFixed(2)}$`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#4a6a9a" }}>{open ? "Свернуть" : "Развернуть"}</span>
      </button>

      {open && (
        <div style={{
          width: "100%",
          height: 480,
          borderRadius: "0 0 12px 12px",
          overflow: "hidden",
          border: "1px solid rgba(0,180,255,0.15)",
          borderTop: "none",
          background: "rgba(5,8,25,0.5)"
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.15}
            maxZoom={2}
          >
            <Background color="#00cfff0d" gap={16} size={1} />
            <Controls style={{ display: "flex", flexDirection: "column" }} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
