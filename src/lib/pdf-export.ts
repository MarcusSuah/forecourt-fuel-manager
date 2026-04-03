// Simple client-side PDF generation using a printable HTML approach
export function exportTableToPDF(
  title: string,
  subtitle: string,
  headers: string[],
  rows: string[][],
  summaryCards?: { label: string; value: string }[]
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export PDF");
    return;
  }

  const summaryHTML = summaryCards?.length
    ? `<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
        ${summaryCards.map(c => `
          <div style="flex:1;min-width:140px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">${c.label}</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${c.value}</div>
          </div>
        `).join("")}
      </div>`
    : "";

  const tableHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>${headers.map(h => `<th style="text-align:left;padding:8px 12px;background:#f1f5f9;border-bottom:2px solid #cbd5e1;font-weight:600;color:#334155;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row, i) => `
          <tr style="background:${i % 2 === 0 ? "#fff" : "#fafafa"}">
            ${row.map(cell => `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${cell}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #0f172a; }
      </style>
    </head>
    <body>
      <div style="margin-bottom:24px">
        <h1 style="font-size:22px;font-weight:700;margin:0 0 4px">${title}</h1>
        <p style="font-size:13px;color:#64748b;margin:0">${subtitle}</p>
        <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">Generated: ${new Date().toLocaleString()}</p>
      </div>
      ${summaryHTML}
      ${tableHTML}
      <div class="no-print" style="margin-top:24px;text-align:center">
        <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500">
          Print / Save as PDF
        </button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}
