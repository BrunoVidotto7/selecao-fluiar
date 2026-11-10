import Icon from '../ui/Icon';
import { imageSource } from '@/lib/format';

// Plain <img>: the image comes from an authenticated cookie proxy, so next/image cannot be used.
export default function ProductThumb({ imageUrl }) {
  return <span className="thumb">{imageUrl ? <img src={imageSource(imageUrl)} alt="" loading="lazy" /> : <Icon name="bag" />}</span>;
}
