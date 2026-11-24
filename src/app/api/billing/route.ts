import { NextRequest, NextResponse } from 'next/server';
import { finalizeBill } from '@/lib/db';
import { BillingPayloadSchema } from '@/lib/validations';
import {
  checkRateLimit,
  createRateLimitResponse,
  validateCsrfOrigin,
  sanitizeInput,
  maskInternalError,
} from '@/lib/security';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (30 requests/minute per client IP)
  const rateLimitResult = checkRateLimit(req, { limit: 30, windowMs: 60000 });
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // 2. CSRF / Origin Validation
  const csrfCheck = validateCsrfOrigin(req);
  if (!csrfCheck.valid) {
    return NextResponse.json({ error: csrfCheck.reason || 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await req.json();

    // 3. Schema Validation via Zod
    const parseResult = BillingPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: `Invalid billing payload: ${issue.path.join('.') || 'root'} - ${issue.message}` },
        { status: 400 }
      );
    }

    const {
      shop_id,
      user_id,
      items,
      idempotency_key,
      subtotal,
      tax,
      discount,
      final_total,
      customer_name,
      customer_phone,
    } = parseResult.data;

    // 4. Input Sanitization against XSS
    const cleanCustomerName = customer_name ? sanitizeInput(customer_name) : undefined;
    const cleanCustomerPhone = customer_phone ? sanitizeInput(customer_phone) : undefined;
    const cleanIdempotencyKey = idempotency_key ? sanitizeInput(idempotency_key) : `bill_${Date.now()}`;

    const result = await finalizeBill({
      shop_id,
      user_id: user_id || '',
      customer_name: cleanCustomerName,
      customer_phone: cleanCustomerPhone,
      subtotal: Number(subtotal || 0),
      tax: Number(tax || 0),
      discount: Number(discount || 0),
      final_total: Number(final_total || 0),
      idempotency_key: cleanIdempotencyKey,
      items: items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: Number(it.unit_price || 0),
      })),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Billing processing error:', error?.message);
    const masked = maskInternalError(error, 'An error occurred while processing the bill. Please try again.');
    return NextResponse.json({ error: masked.message }, { status: masked.status });
  }
}

