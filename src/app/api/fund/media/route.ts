import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { requireActor } from '@/server/auth';
import { getDb } from '@/server/db';
import { DomainError } from '@/server/permissions';
import { financeAction } from '@/server/finance/service';
import { getCloudinaryConfig, isCloudinaryConfigured } from '@/server/fundraising/service';
import { checkMutation, apiError } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cfg = getCloudinaryConfig();
    return NextResponse.json({
      ok: true,
      configured: isCloudinaryConfigured(),
      cloudName: cfg.cloudName,
      apiKey: cfg.apiKey,
      uploadPreset: cfg.uploadPreset,
      signedUploadAvailable: Boolean(cfg.cloudName && cfg.apiKey && cfg.hasValidSecret),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const actor = await requireActor();
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : 'validate';
    const cfg = getCloudinaryConfig();

    if (action === 'sign') {
      const folder =
        typeof body.folder === 'string' && /^[a-zA-Z0-9/_-]+$/.test(body.folder)
          ? body.folder
          : 'huriza_fund';

      if (cfg.cloudName && cfg.apiKey && cfg.hasValidSecret) {
        const timestamp = Math.floor(Date.now() / 1000);
        const toSign = `folder=${folder}&timestamp=${timestamp}${cfg.apiSecret}`;
        const signature = createHash('sha1').update(toSign).digest('hex');
        return NextResponse.json({
          ok: true,
          mode: 'signed',
          cloudName: cfg.cloudName,
          apiKey: cfg.apiKey,
          timestamp,
          folder,
          signature,
        });
      }
      if (cfg.cloudName && cfg.uploadPreset) {
        return NextResponse.json({
          ok: true,
          mode: 'unsigned_preset',
          cloudName: cfg.cloudName,
          uploadPreset: cfg.uploadPreset,
          folder,
        });
      }
      return NextResponse.json({
        ok: true,
        mode: 'fallback_local',
        cloudName: cfg.cloudName,
        apiKey: cfg.apiKey,
        message:
          'Cloudinary cloud name (a0bcyupp) and API key (249148756432359) are set. Add CLOUDINARY_API_SECRET or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to enable remote cloud upload; using validated local preview URL mode.',
      });
    }

    let url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) {
      throw new DomainError('Media URL is required.', 400);
    }
    const isHttps = /^https:\/\/[^\s]+$/i.test(url);
    const isSafeDataImage = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(url);
    if (!isHttps && !isSafeDataImage) {
      throw new DomainError(
        'Only HTTPS image URLs or valid JPEG/PNG/WebP image uploads are permitted.',
        400
      );
    }
    if (url.length > 2_800_000) {
      throw new DomainError('Image exceeds maximum 2MB size limit.', 413);
    }

    let publicId = typeof body.publicId === 'string' ? body.publicId : '';

    // If a data image is uploaded and Cloudinary secret or preset is configured, upload directly to Cloudinary
    if (isSafeDataImage && cfg.cloudName && (cfg.hasValidSecret || cfg.uploadPreset)) {
      try {
        const folder = 'huriza_fund';
        const formData = new FormData();
        formData.append('file', url);
        formData.append('folder', folder);

        if (cfg.hasValidSecret && cfg.apiKey) {
          const timestamp = String(Math.floor(Date.now() / 1000));
          const signature = createHash('sha1')
            .update(`folder=${folder}&timestamp=${timestamp}${cfg.apiSecret}`)
            .digest('hex');
          formData.append('api_key', cfg.apiKey);
          formData.append('timestamp', timestamp);
          formData.append('signature', signature);
        } else if (cfg.uploadPreset) {
          formData.append('upload_preset', cfg.uploadPreset);
        }

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );
        if (cloudRes.ok) {
          const cloudData = (await cloudRes.json()) as {
            secure_url?: string;
            public_id?: string;
          };
          if (cloudData.secure_url) {
            url = cloudData.secure_url;
            publicId = cloudData.public_id || publicId;
          }
        }
      } catch {
        // Fall back to validated image URL if remote network call is unavailable
      }
    }

    if (typeof body.campaignId === 'string' && body.campaignId.trim()) {
      const db = await getDb();
      const result = await financeAction(db, actor, {
        action: 'addCampaignMedia',
        campaignId: body.campaignId.trim(),
        url: isSafeDataImage && url.startsWith('data:') ? url.slice(0, 500) : url,
        mediaType: typeof body.mediaType === 'string' ? body.mediaType : 'gallery',
        caption: typeof body.caption === 'string' ? body.caption : '',
        publicId,
      });
      return NextResponse.json({ ok: true, result, validatedUrl: url });
    }

    return NextResponse.json({
      ok: true,
      validatedUrl: url,
      publicId,
      cloudName: cfg.cloudName,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error) {
    return apiError(error);
  }
}
