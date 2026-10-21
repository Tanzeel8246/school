import Select, { Props as SelectProps, GroupBase } from 'react-select';
import { cn } from '@/lib/utils';

interface SearchableSelectProps<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
> extends SelectProps<Option, IsMulti, Group> {
  error?: boolean;
}

export function SearchableSelect<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
>({ error, className, ...props }: SearchableSelectProps<Option, IsMulti, Group>) {
  return (
    <Select
      {...props}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      }}
      className={cn('text-sm', className)}
      classNames={{
        control: (state) =>
          cn(
            'flex min-h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-1',
            'transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
            error ? 'border-destructive focus-within:ring-destructive' : 'focus-within:border-ring',
            state.isDisabled ? 'cursor-not-allowed opacity-50 bg-muted' : 'bg-background',
          ),
        valueContainer: () => 'p-0 gap-1',
        menu: () => 'mt-1 rounded-lg border border-border bg-card shadow-md z-50',
        menuList: () => 'p-1',
        option: (state) =>
          cn(
            'cursor-default rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
            state.isFocused ? 'bg-muted text-foreground' : 'text-foreground',
            state.isSelected ? 'bg-primary/10 text-primary font-medium' : '',
          ),
        noOptionsMessage: () => 'p-2 text-sm text-muted-foreground text-center',
        indicatorSeparator: () => 'hidden',
        dropdownIndicator: () => 'p-1 text-muted-foreground hover:text-muted-foreground cursor-pointer',
        clearIndicator: () => 'p-1 text-muted-foreground hover:text-muted-foreground cursor-pointer',
        multiValue: () => 'bg-muted rounded-sm px-1.5 py-0.5 m-0.5 flex items-center gap-1',
        multiValueLabel: () => 'text-xs text-foreground',
        multiValueRemove: () => 'hover:bg-slate-200 hover:text-foreground rounded-sm text-muted-foreground',
      }}
      unstyled
    />
  );
}
