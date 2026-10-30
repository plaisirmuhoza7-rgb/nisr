import Image from 'next/image';
import type { CSSProperties } from 'react';

export interface BrandLogoProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  rounded?: boolean | number;
}

export default function BrandLogo({
  size = 32,
  className,
  style,
  priority = false,
  rounded = true,
}: BrandLogoProps) {
  const borderRadius =
    typeof rounded === 'number'
      ? rounded
      : rounded
      ? Math.max(6, Math.round(size * 0.24))
      : 0;

  return (
    <Image
      src="/logo.png"
      alt="HURIZA"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{
        borderRadius,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        ...style,
      }}
    />
  );
}
