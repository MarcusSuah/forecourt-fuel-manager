import { Wallet, DollarSign, CreditCard, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashSummaryProps {
  cashLRD: number;
  cashUSD: number;
  cardSalesUSD: number;
  exchangeRate: number;
}

export function CashSummary({ cashLRD, cashUSD, cardSalesUSD, exchangeRate }: CashSummaryProps) {
  const totalUSD = cashUSD + (cashLRD / exchangeRate) + cardSalesUSD;

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground">Daily Cash Summary</h3>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Wallet className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-4">
        {/* LRD Cash */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
              L$
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash (LRD)</p>
              <p className="font-semibold text-foreground">
                L${cashLRD.toLocaleString()}
              </p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            ≈ ${(cashLRD / exchangeRate).toFixed(2)} USD
          </span>
        </div>

        {/* USD Cash */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash (USD)</p>
              <p className="font-semibold text-foreground">
                ${cashUSD.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Card Sales */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Card Sales (USD)</p>
              <p className="font-semibold text-foreground">
                ${cardSalesUSD.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total (USD Equivalent)</p>
            <p className="text-2xl font-bold text-foreground">
              ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-1 text-success text-sm font-medium">
            <ArrowUpRight className="h-4 w-4" />
            <span>+12.5%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Exchange Rate: L${exchangeRate} = $1 USD
        </p>
      </div>
    </div>
  );
}
