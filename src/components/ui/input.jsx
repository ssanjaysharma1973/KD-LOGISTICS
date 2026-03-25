import React from "react";

export default function Input(props) {
  return (
    <input
      {...props}
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        border: "1px solid #ccc",
        fontSize: "1em",
        marginBottom: 4,
        ...props.style
      }}
    />
  );
}