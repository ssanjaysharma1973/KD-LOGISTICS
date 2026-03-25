import React from "react";

export default function Card({ children, ...props }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 8px #0001",
      padding: 16,
      margin: 8,
      border: "2px solid #3b82f6",
      ...props.style
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ children, ...props }) {
  return (
    <div style={{ borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 8, ...props.style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children, ...props }) {
  return (
    <h2 style={{ fontSize: "1.25em", fontWeight: "bold", margin: 0, ...props.style }}>
      {children}
    </h2>
  );
}

export function CardContent({ children, ...props }) {
  return (
    <div style={{ ...props.style }}>
      {children}
    </div>
  );
}