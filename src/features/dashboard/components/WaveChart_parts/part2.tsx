          />

          {/* Interactive Nodes / Circles */}
          {coords.map((c, idx) => {
            const isHovered = selectedIdx === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
              >
                {/* Vertical Cursor Guide when selected */}
                {isHovered && (
                  <line
                    x1={c.x}
                    y1={paddingY}
                    x2={c.x}
                    y2={height - paddingY}
                    stroke="#D4F63D"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    strokeOpacity="0.7"
                  />
                )}

                {/* Outer Glow Circle */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 7 : 4.5}
                  fill="#141518"
                  stroke="#D4F63D"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* Inner Dot */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 3.5 : 2}
                  fill="#D4F63D"
                />

                {/* X-axis tick labels */}
                <text
                  x={c.x}
                  y={height + 14}
                  textAnchor="middle"
                  fill={isHovered ? "#D4F63D" : "#8E929E"}
                  fontSize="9.5"
                  fontWeight={isHovered ? "bold" : "600"}
                >
                  {c.point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
