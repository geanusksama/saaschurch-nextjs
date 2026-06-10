export function SantanderIcon({ className }: { className?: string }) {
  // Extrai tamanho do className (h-4, h-5, etc.) para manter dimensão consistente com os outros ícones
  const match = className?.match(/h-(\d+(?:\.\d+)?)/);
  const rem = match ? parseFloat(match[1]) * 0.25 : 1.25; // h-5 = 1.25rem
  const size = `${rem}rem`;

  return (
    <img
      src="/santander.png"
      alt="Santander"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
