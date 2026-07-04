import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#15803d",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "sans-serif",
            letterSpacing: "-1px",
          }}
        >
          FP
        </div>
      </div>
    ),
    { ...size }
  )
}
