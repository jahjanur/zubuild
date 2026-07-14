/**
 * Official AEM Residence logo. The source SVG is a single-colour (black) vector,
 * so we render it via a CSS mask and paint it with `currentColor` — that lets
 * one asset show white on the dark sidebar, dark on print, etc. without shipping
 * multiple colour variants. Uses object-fit: contain via mask-size; never stretches.
 */
export function AemLogo({
  variant = 'full',
  className = '',
}: {
  variant?: 'full' | 'mark';
  className?: string;
}) {
  const src = variant === 'mark' ? '/aem-mark.svg' : '/aem-logo.svg';
  const aspectRatio = variant === 'mark' ? '205 / 245' : '860 / 280';
  return (
    <span
      role="img"
      aria-label="AEM Residence"
      className={className}
      style={{
        display: 'inline-block',
        aspectRatio,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
