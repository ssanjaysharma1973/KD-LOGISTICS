import React from "react";

export default function Badge({ children, ...props }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "0.25em 0.75em",
      borderRadius: "1em",
      background: "#e0e7ff",
      color: "#3730a3",
      fontWeight: 600,
      fontSize: "0.85em",
      ...props.style
    }}>
      {children || "Badge"}
    </span>
  );
}