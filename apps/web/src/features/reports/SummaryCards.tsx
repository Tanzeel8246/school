import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { humanize, money } from '@/lib/format';

interface Props {
  summary: Record<string, number | string>;
  /** Keys whose values are integer minor-unit money amounts. */
  moneyKeys?: string[];
}

/** Renders a summary object as a responsive grid of KPI cards. */
export function SummaryCards({ summary, moneyKeys = [] }: Props) {
  const entries = Object.entries(summary);
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([key, value]) => {
        const isMoney = moneyKeys.includes(key);
        const display =
          isMoney && typeof value === 'number'
            ? money(value)
            : typeof value === 'number'
            ? value.toLocaleString()
            : String(value);

        return (
          <Card key={key}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {humanize(key)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4 pt-0">
              <p className="text-2xl font-semibold tracking-tight text-foreground">{display}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
