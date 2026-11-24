import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/db';
import { ProductSearchQuerySchema } from '@/lib/validations';
import {
  checkRateLimit,
  createRateLimitResponse,
  sanitizeInput,
  maskInternalError,
} from '@/lib/security';

export async function GET(req: NextRequest) {
  // 1. Rate Limiting (100 requests/minute per client IP)
  const rateLimitResult = checkRateLimit(req, { limit: 100, windowMs: 60000 });
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = {
      q: searchParams.get('q') || undefined,
      category: searchParams.get('category') || undefined,
      lat: searchParams.get('lat') || undefined,
      lon: searchParams.get('lon') || undefined,
      radius: searchParams.get('radius') || undefined,
      inStock: searchParams.get('inStock') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
    };

    // 2. Query Validation via Zod
    const parseResult = ProductSearchQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: `Invalid search parameters: ${issue.path.join('.') || 'param'} - ${issue.message}` },
        { status: 400 }
      );
    }

    const { q, category, lat, lon, radius, inStock, sortBy } = parseResult.data;

    // 3. Input Sanitization
    const cleanQuery = q ? sanitizeInput(q) : undefined;
    const cleanCategory = category ? sanitizeInput(category) : undefined;

    const results = await searchProducts({
      query: cleanQuery,
      category: cleanCategory,
      customerLat: lat,
      customerLon: lon,
      radiusKm: radius,
      onlyInStock: inStock ?? true,
      sortBy: sortBy || 'relevance',
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    const masked = maskInternalError(error, 'Server error searching products');
    return NextResponse.json({ error: masked.message }, { status: masked.status });
  }
}

