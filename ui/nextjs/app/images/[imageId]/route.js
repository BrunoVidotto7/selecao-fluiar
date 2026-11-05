import { readProductImage } from '@/lib/product-images.server';
export const dynamic = 'force-dynamic';
export async function GET(_request, { params }) { return readProductImage((await params).imageId); }
