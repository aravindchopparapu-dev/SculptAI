export default function BrandMark({ website = false }: { website?: boolean }) {
  return <img className="brand-mark" src={website ? '/brand/neural-brain-website.png' : '/brand/neural-brain-256.png'} width={44} height={44} alt="" decoding="async" />;
}
