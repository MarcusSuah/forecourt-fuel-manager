import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, User } from "lucide-react";

interface EmployeeIDCardProps {
  employee: {
    full_name: string;
    position: string;
    employee_id?: string | null;
    phone?: string | null;
    photo_url?: string | null;
    employment_date: string;
    employment_status?: string;
  };
  branchName: string;
}

export function EmployeeIDCard({ employee, branchName }: EmployeeIDCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print ID Card");
      return;
    }

    const photoHTML = employee.photo_url
      ? `<img src="${employee.photo_url}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #1e40af;" />`
      : `<div style="width:90px;height:90px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;border:3px solid #1e40af;font-size:36px;color:#94a3b8;">👤</div>`;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>ID Card - ${employee.full_name}</title>
      <style>
        @media print { body { margin:0; } .no-print { display:none; } @page { size: 3.375in 2.125in; margin:0; } }
        * { box-sizing: border-box; margin:0; padding:0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#f1f5f9; }
      </style></head><body>
      <div style="width:3.375in;height:2.125in;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:12px;overflow:hidden;color:white;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <!-- Header -->
        <div style="background:rgba(255,255,255,0.1);padding:6px 14px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⛽ ${branchName}</div>
            <div style="font-size:7px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;">EMPLOYEE IDENTIFICATION CARD</div>
          </div>
          <div style="font-size:7px;background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:4px;">FMS</div>
        </div>
        <!-- Body -->
        <div style="display:flex;padding:10px 14px;gap:12px;align-items:center;">
          ${photoHTML}
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;margin-bottom:3px;">${employee.full_name}</div>
            <div style="font-size:9px;color:#93c5fd;font-weight:600;margin-bottom:6px;">${employee.position}</div>
            <div style="font-size:8px;color:rgba(255,255,255,0.8);line-height:1.6;">
              ${employee.employee_id ? `<div><span style="color:rgba(255,255,255,0.5);">ID:</span> ${employee.employee_id}</div>` : ""}
              ${employee.phone ? `<div><span style="color:rgba(255,255,255,0.5);">Phone:</span> ${employee.phone}</div>` : ""}
              <div><span style="color:rgba(255,255,255,0.5);">Since:</span> ${employee.employment_date}</div>
            </div>
          </div>
        </div>
        <!-- Footer -->
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,0.08);padding:4px 14px;display:flex;justify-content:space-between;font-size:7px;color:rgba(255,255,255,0.5);">
          <span>Forecourt Management System</span>
          <span>Valid while employed</span>
        </div>
      </div>
      <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print ID Card</button>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint} title="Print ID Card">
      <Printer className="h-4 w-4" />
    </Button>
  );
}
