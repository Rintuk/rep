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

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

const CustomNode = ({ data }: any) => {
  return (
    <div style={{
      background: data.isRoot ? "rgba(34,201,122,0.15)" : "rgba(0,180,255,0.1)",
      border: `1px solid ${data.isRoot ? "rgba(34,201,122,0.4)" : "rgba(0,180,255,0.3)"}`,
      borderRadius: 12,
      padding: "10px 14px",
      minWidth: 180,
      backdropFilter: "blur(12px)",
      color: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
    }}>
      <Handle type="target" position={Position.Top} style={{ background: "#4a6a9a" }} />
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {data.email}
      </div>
      {!data.isRoot && (
        <div style={{ fontSize: 11, color: "#4a6a9a", display: "flex", justifyContent: "space-between" }}>
          <span>L{data.level}</span>
          <span style={{ color: data.investment > 0 ? "#fff" : "#4a6a9a" }}>${data.investment?.toFixed(2)}</span>
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

export default function ReferralNetwork({ data, rootEmail }: { data: ReferralInfo[], rootEmail: string }) {
  const [open, setOpen] = useState(false);

  const initialNodes: Node[] = [];
  const initialEdges: Edge[] = [];

  initialNodes.push({
    id: "root",
    type: "custom",
    position: { x: 0, y: 0 },
    data: { email: rootEmail, isRoot: true, label: "Вы" },
  });

  data.forEach((ref) => {
    initialNodes.push({
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

    const isLevel1 = !data.some(d => d.id === ref.parent_id);
    initialEdges.push({
      id: `e-${isLevel1 ? "root" : ref.parent_id}-${ref.id}`,
      source: isLevel1 ? "root" : (ref.parent_id || "root"),
      target: ref.id,
      type: "smoothstep",
      animated: ref.investment_usdt > 0,
      style: { stroke: ref.investment_usdt > 0 ? "#00cfff" : "#4a6a9a", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: ref.investment_usdt > 0 ? "#00cfff" : "#4a6a9a",
      },
    });
  });

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [data]);

  const totalRefs = data.length;
  const activeRefs = data.filter(r => r.investment_usdt > 0).length;

  return (
    <div style={{ width: "100%" }}>
      {/* Collapsed header — always visible */}
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
          <span style={{ fontSize: 16 }}>{open ? "▲" : "▼"}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Структура сети
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#4a6a9a" }}>
          {open ? "Свернуть" : "Развернуть"}
        </span>
      </button>

      {/* Tree — shown only when open */}
      {open && (
        <div style={{
          width: "100%",
          height: 500,
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
            minZoom={0.2}
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
