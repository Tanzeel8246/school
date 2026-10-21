import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface FilterDef {
  key: string;
  label: string;
  type: 'date' | 'select' | 'text';
  options?: { value: string; label: string }[];
}

interface Props {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/**
 * Horizontal (sm+) / vertical (mobile) filter bar.
 * Renders labelled inputs/selects for each FilterDef.
 */
export function ReportFilters({ filters, values, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {filters.map((f) => (
        <div key={f.key} className="flex w-full flex-col gap-1 sm:w-auto">
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          {f.type === 'select' && f.options ? (
            <Select
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="sm:w-44"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.type === 'date' ? 'date' : 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="sm:w-44"
            />
          )}
        </div>
      ))}
    </div>
  );
}
