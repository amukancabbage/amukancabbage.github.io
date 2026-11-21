import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AppIcon({ icon: Glyph, size = 16, className = '' }: {
  icon: LucideIcon;
  size?: 16 | 20;
  className?: string;
}) {
  return <Glyph size={size} strokeWidth={1.8} className={'tw:inline-block tw:shrink-0 ' + className} aria-hidden="true" focusable="false" />;
}

export function IconLabel({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="tw:inline-flex tw:max-w-full tw:items-center tw:gap-1.5 tw:align-middle">
      <AppIcon icon={icon} />
      <span className="tw:min-w-0">{children}</span>
    </span>
  );
}
