import React, { useMemo } from "react";

const campaignData = [
  {
    id: 1,
    campaign: "AI/ML Outreach Campaign",
    sent: 200,
    delivered: 180,
    replied: 35,
    bounced: 20,
  },
  {
    id: 2,
    campaign: "Technology Partnership Campaign",
    sent: 150,
    delivered: 140,
    replied: 25,
    bounced: 10,
  },
];

export default function Outcomes() {
  const summary = useMemo(() => {
    const sent = campaignData.reduce((sum, item) => sum + item.sent, 0);

    const delivered = campaignData.reduce(
      (sum, item) => sum + item.delivered,
      0
    );

    const replied = campaignData.reduce(
      (sum, item) => sum + item.replied,
      0
    );

    const bounced = campaignData.reduce(
      (sum, item) => sum + item.bounced,
      0
    );

    return {
      sent,
      delivered,
      replied,
      bounced,
    };
  }, []);

  const deliveryRate =
    summary.sent > 0
      ? ((summary.delivered / summary.sent) * 100).toFixed(1)
      : "0.0";

  const replyRate =
    summary.delivered > 0
      ? ((summary.replied / summary.delivered) * 100).toFixed(1)
      : "0.0";

  const bounceRate =
    summary.sent > 0
      ? ((summary.bounced / summary.sent) * 100).toFixed(1)
      : "0.0";

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
  };

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: "700",
          marginBottom: "10px",
        }}
      >
        Campaign Outcomes Dashboard
      </h1>

      <p
        style={{
          color: "#6b7280",
          marginBottom: "24px",
        }}
      >
        Review campaign delivery, reply, and bounce performance.
      </p>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={cardStyle}>
          <h3>Total Sent</h3>
          <h2>{summary.sent}</h2>
        </div>

        <div style={cardStyle}>
          <h3>Delivered</h3>
          <h2 style={{ color: "#15803d" }}>
            {summary.delivered}
          </h2>
        </div>

        <div style={cardStyle}>
          <h3>Replied</h3>
          <h2 style={{ color: "#2563eb" }}>
            {summary.replied}
          </h2>
        </div>

        <div style={cardStyle}>
          <h3>Bounced</h3>
          <h2 style={{ color: "#dc2626" }}>
            {summary.bounced}
          </h2>
        </div>
      </div>

      {/* Metrics */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h2>Campaign Performance Metrics</h2>

        <p>
          <strong>Delivery Rate:</strong> {deliveryRate}%
        </p>

        <p>
          <strong>Reply Rate:</strong> {replyRate}%
        </p>

        <p>
          <strong>Bounce Rate:</strong> {bounceRate}%
        </p>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ padding: "12px" }}>Campaign</th>
              <th style={{ padding: "12px" }}>Sent</th>
              <th style={{ padding: "12px" }}>Delivered</th>
              <th style={{ padding: "12px" }}>Replied</th>
              <th style={{ padding: "12px" }}>Bounced</th>
            </tr>
          </thead>

          <tbody>
            {campaignData.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: "12px", borderTop: "1px solid #eee" }}>
                  {item.campaign}
                </td>

                <td style={{ padding: "12px", borderTop: "1px solid #eee" }}>
                  {item.sent}
                </td>

                <td style={{ padding: "12px", borderTop: "1px solid #eee" }}>
                  {item.delivered}
                </td>

                <td style={{ padding: "12px", borderTop: "1px solid #eee" }}>
                  {item.replied}
                </td>

                <td style={{ padding: "12px", borderTop: "1px solid #eee" }}>
                  {item.bounced}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}