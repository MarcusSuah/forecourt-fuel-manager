import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { useCallback } from "react";

interface EmployeeData {
  full_name: string;
  position: string;
  employee_id?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  employment_date: string;
  employment_status?: string;
}

interface EmployeeIDCardProps {
  employee: EmployeeData;
  branchName: string;
}

function generateCardHTML(employee: EmployeeData, branchName: string, qrDataUrl: string, barcodeDataUrl: string) {
  const photoHTML = employee.photo_url
    ? `<img src="${employee.photo_url}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #1e40af;" />`
    : `<div style="width:90px;height:90px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;border:3px solid #1e40af;font-size:36px;color:#94a3b8;">👤</div>`;

  const empId = employee.employee_id || "N/A";

  const qrHTML = qrDataUrl
    ? `<img src="${qrDataUrl}" style="width:55px;height:55px;border-radius:4px;" />`
    : "";

  const barcodeHTML = barcodeDataUrl
    ? `<img src="${barcodeDataUrl}" style="height:28px;width:auto;" />`
    : "";

  return `<div style="width:3.375in;height:2.125in;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:12px;overflow:hidden;color:white;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.3);page-break-inside:avoid;page-break-after:always;">
    <div style="background:rgba(255,255,255,0.1);padding:5px 12px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⛽ ${branchName}</div>
        <div style="font-size:6px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;">EMPLOYEE IDENTIFICATION CARD</div>
      </div>
      <div style="font-size:7px;background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:4px;">FMS</div>
    </div>
    <div style="display:flex;padding:6px 12px;gap:10px;align-items:center;">
      ${photoHTML}
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:700;margin-bottom:2px;">${employee.full_name}</div>
        <div style="font-size:8px;color:#93c5fd;font-weight:600;margin-bottom:4px;">${employee.position}</div>
        <div style="font-size:7px;color:rgba(255,255,255,0.8);line-height:1.5;">
          <div><span style="color:rgba(255,255,255,0.5);">ID:</span> ${empId}</div>
          ${employee.phone ? `<div><span style="color:rgba(255,255,255,0.5);">Phone:</span> ${employee.phone}</div>` : ""}
          <div><span style="color:rgba(255,255,255,0.5);">Since:</span> ${employee.employment_date}</div>
        </div>
      </div>
    </div>
    <div style="position:absolute;right:8px;bottom:26px;display:flex;flex-direction:column;align-items:center;gap:2px;">
      ${qrHTML}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,0.08);padding:3px 12px;display:flex;justify-content:space-between;align-items:center;font-size:6px;color:rgba(255,255,255,0.5);">
      <div style="display:flex;flex-direction:column;">
        ${barcodeHTML}
        <span style="margin-top:1px;">Forecourt Management System</span>
      </div>
      <div style="text-align:right;line-height:1.3;">
        <div style="border-bottom:1px solid rgba(255,255,255,0.3);width:60px;margin-bottom:1px;"></div>
        <span>Dealer Signature</span>
      </div>
    </div>
  </div>`;
}

async function generateCodes(employee: EmployeeData, branchName: string) {
  const qrData = JSON.stringify({
    name: employee.full_name,
    id: employee.employee_id || "N/A",
    position: employee.position,
    branch: branchName,
  });

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 80, margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    });
  } catch { /* ignore */ }

  let barcodeDataUrl = "";
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, employee.employee_id || employee.full_name.substring(0, 12), {
      format: "CODE128", width: 1, height: 30, margin: 0,
      displayValue: false, background: "transparent", lineColor: "#ffffff",
    });
    barcodeDataUrl = canvas.toDataURL();
  } catch { /* ignore */ }

  return { qrDataUrl, barcodeDataUrl };
}

export function EmployeeIDCard({ employee, branchName }: EmployeeIDCardProps) {
  const handlePrint = useCallback(async () => {
    const { qrDataUrl, barcodeDataUrl } = await generateCodes(employee, branchName);
    const cardHTML = generateCardHTML(employee, branchName, qrDataUrl, barcodeDataUrl);

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow popups to print ID Card"); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>ID Card - ${employee.full_name}</title>
      <style>
        @media print { body { margin:0; } .no-print { display:none; } @page { size: 3.375in 2.125in; margin:0; } }
        * { box-sizing: border-box; margin:0; padding:0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#f1f5f9; }
      </style></head><body>
      ${cardHTML}
      <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print ID Card</button>
    </body></html>`);
    printWindow.document.close();
  }, [employee, branchName]);

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint} title="Print ID Card">
      <Printer className="h-4 w-4" />
    </Button>
  );
}

interface BulkPrintProps {
  employees: EmployeeData[];
  getBranchName: (emp: EmployeeData) => string;
}

export function BulkPrintIDCards({ employees, getBranchName }: BulkPrintProps) {
  const handleBulkPrint = useCallback(async () => {
    if (!employees.length) { toast("No employees to print"); return; }

    const cards = await Promise.all(
      employees.map(async (emp) => {
        const branch = getBranchName(emp);
        const { qrDataUrl, barcodeDataUrl } = await generateCodes(emp, branch);
        return generateCardHTML(emp, branch, qrDataUrl, barcodeDataUrl);
      })
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow popups"); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>All Employee ID Cards</title>
      <style>
        @media print { .no-print { display:none; } @page { size: 3.375in 2.125in; margin:0; } }
        * { box-sizing: border-box; margin:0; padding:0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display:flex; flex-direction:column; align-items:center; gap:20px; padding:20px; background:#f1f5f9; }
      </style></head><body>
      <h2 class="no-print" style="font-size:18px;color:#1e293b;">All Employee ID Cards (${employees.length})</h2>
      ${cards.join("\n")}
      <button class="no-print" onclick="window.print()" style="margin:20px 0;padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print All Cards</button>
    </body></html>`);
    printWindow.document.close();
  }, [employees, getBranchName]);

  return (
    <Button variant="outline" size="sm" onClick={handleBulkPrint}>
      <Printer className="h-4 w-4 mr-2" /> Print All ID Cards
    </Button>
  );
}

// Need toast for bulk print
import { toast } from "sonner";
