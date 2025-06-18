// src/app/api/leads/upload/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { Readable } from 'stream';
import redis from '@/lib/redis';
import { logSystemEvent } from '@/services/logService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

async function invalidateLeadCaches() {
  try {
    const leadCacheKeys = await redis.keys('leads:*');
    const regionCacheKeys = await redis.keys('market_regions:*');
    const allKeys = [...leadCacheKeys, ...regionCacheKeys];
    
    if (allKeys.length > 0) {
      await logSystemEvent({
        event_type: 'CACHE_INVALIDATION',
        message: `Upload invalidating cache keys.`,
        details: { keys: allKeys },
        level: 'DEBUG'
      });
      await redis.del(allKeys);
    }
  } catch (error) {
    console.error('Failed to invalidate Redis cache after upload:', error);
    await logSystemEvent({
      event_type: 'CACHE_INVALIDATION_ERROR',
      message: 'Failed to invalidate Redis cache after upload.',
      details: { error: error instanceof Error ? error.message : String(error) },
      level: 'ERROR'
    });
  }
}

function sanitizeAndParseFloat(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }
  const sanitizedValue = value.replace(/[^0-9.-]+/g, "");
  if (sanitizedValue === '') {
    return null;
  }
  const number = parseFloat(sanitizedValue);
  return isNaN(number) ? null : number;
}

function sanitizeAndParseInt(value: string | null | undefined): number | null {
    if (value === null || value === undefined || value.trim() === '') {
      return null;
    }
    const sanitizedValue = value.replace(/[^0-9-]+/g, "");
    if (sanitizedValue === '') {
        return null;
    }
    const number = parseInt(sanitizedValue, 10);
    return isNaN(number) ? null : number;
}

function formatDateForDB(dateString: string | null | undefined): string | null {
    if (!dateString) {
        return null;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return null;
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let jobId: string | null = null;
  let userId: string | null = null;
  let fileName: string | null = null;
  let marketRegion: string | null = null;

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      await logSystemEvent({
        event_type: 'UPLOAD_AUTH_ERROR',
        message: 'Unauthorized attempt to upload leads.',
        details: { error: authErr?.message || 'No user found' },
        level: 'ERROR'
      });
      return NextResponse.json({ ok: false, message: 'Not authenticated' }, { status: 401 });
    }
    userId = user.id;

    const form = await request.formData();
    const file = form.get('file');
    jobId = form.get('job_id') as string;
    marketRegion = form.get('market_region') as string;
    
    if (!file || typeof file === 'string' || !jobId || !marketRegion) {
      const missingFields: string[] = [];
      if (!file || typeof file === 'string') missingFields.push('file');
      if (!jobId) missingFields.push('job_id');
      if (!marketRegion) missingFields.push('market_region');

      await logSystemEvent({
        event_type: 'UPLOAD_VALIDATION_ERROR',
        message: 'Missing required fields for lead upload.',
        details: { jobId, userId, missingFields },
        level: 'ERROR'
      });
      return NextResponse.json({ ok: false, message: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }
    
    fileName = file.name;
    const filePath = `${userId}/${jobId}-${fileName}`;

    // STAGE 1: Initialize Job
    await supabase.from('upload_jobs').insert({
      job_id: jobId,
      user_id: userId,
      file_name: fileName,
      status: 'PENDING',
      progress: 5,
      message: 'Upload job initialized...'
    });
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_JOB_INIT',
      message: `Upload job ${jobId} initialized for file ${fileName}.`,
      details: { jobId, fileName, userId, marketRegion },
      level: 'INFO'
    });

    // STAGE 2: Duplicate Check
    const { data: dup, error: dupError } = await supabase.from('file_imports').select('file_key').eq('file_key', filePath);
    if (dupError) throw dupError;

    if (dup?.length) {
      throw new Error('This file has already been imported.');
    }

    await supabase.from('upload_jobs').update({ progress: 10, message: 'Duplicate check passed. Starting upload...' }).eq('job_id', jobId);
    
    // STAGE 3: Stream and Process
    const fileStream = file.stream();
    const [storageStream, csvStream] = fileStream.tee();

    const storageUploadPromise = supabase.storage
      .from('lead-uploads')
      .upload(filePath, storageStream, { 
          contentType: file.type, 
          upsert: false,
          duplex: 'half'
        });

    const processCsvPromise = new Promise<number>((resolve, reject) => {
      const batch: any[] = [];
      const batchSize = 250;
      let rowCount = 0;
      let chunkCount = 0;

      Papa.parse(Readable.fromWeb(csvStream as any), {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          parser.pause();
          if (results.errors.length > 0) {
            return reject(new Error(`CSV parsing errors: ${JSON.stringify(results.errors)}`));
          }
          
          chunkCount++;
          const progress = Math.min(60, 20 + chunkCount * 2); // Increment progress slightly per chunk
          
          await supabase.from('upload_jobs').update({ progress, message: `Staging data chunk #${chunkCount}...` }).eq('job_id', jobId as string);
          
          try {
            const sanitizedRows = results.data.map(r => ({
              // ... (all sanitization logic remains the same) ...
                property_address: (r as any).PropertyAddress,
                property_city: (r as any).PropertyCity,
                property_state: (r as any).PropertyState,
                property_postal_code: (r as any).PropertyPostalCode,
                property_type: (r as any).PropertyType,
                owner_type: (r as any).OwnerType,
                year_built: sanitizeAndParseInt((r as any).YearBuilt),
                square_footage: sanitizeAndParseInt((r as any).SquareFootage),
                lot_size_sqft: sanitizeAndParseFloat((r as any).LotSizeSqFt),
                baths: sanitizeAndParseFloat((r as any).Baths),
                beds: sanitizeAndParseInt((r as any).Beds),
                price_per_sqft: sanitizeAndParseFloat((r as any).PricePerSqFt),
                assessed_year: sanitizeAndParseInt((r as any).AssessedYear),
                assessed_total: sanitizeAndParseFloat((r as any).AssessedTotal),
                market_value: sanitizeAndParseFloat((r as any).MarketValue),
                wholesale_value: sanitizeAndParseFloat((r as any).WholesaleValue),
                avm: sanitizeAndParseFloat((r as any).AVM),
                first_name: (r as any).FirstName,
                last_name: (r as any).LastName,
                recipient_address: (r as any).RecipientAddress,
                recipient_city: (r as any).RecipientCity,
                recipient_state: (r as any).RecipientState,
                recipient_postal_code: (r as any).RecipientPostalCode,
                contact1_name: (r as any).Contact1Name,
                contact1_phone_1: (r as any).Contact1Phone_1,
                contact1_email_1: (r as any).Contact1Email_1,
                contact2_name: (r as any).Contact2Name,
                contact2_phone_1: (r as any).Contact2Phone_1,
                contact2_email_1: (r as any).Contact2Email_1,
                contact3_name: (r as any).Contact3Name,
                contact3_phone_1: (r as any).Contact3Phone_1,
                contact3_email_1: (r as any).Contact3Email_1,
                mls_curr_listingid: (r as any).MLS_Curr_ListingID,
                mls_curr_status: (r as any).MLS_Curr_Status,
                mls_curr_listdate: formatDateForDB((r as any).MLS_Curr_ListDate),
                mls_curr_solddate: formatDateForDB((r as any).MLS_Curr_SoldDate),
                mls_curr_daysonmarket: sanitizeAndParseInt((r as any).MLS_Curr_DaysOnMarket),
                mls_curr_listprice: sanitizeAndParseFloat((r as any).MLS_Curr_ListPrice),
                mls_curr_saleprice: sanitizeAndParseFloat((r as any).MLS_Curr_SalePrice),
                mls_curr_listagentname: (r as any).MLS_Curr_ListAgentName,
                mls_curr_listagentphone: (r as any).MLS_Curr_ListAgentPhone,
                mls_curr_listagentemail: (r as any).MLS_Curr_ListAgentEmail,
                mls_curr_pricepersqft: sanitizeAndParseFloat((r as any).MLS_Curr_PricePerSqft),
                mls_curr_sqft: sanitizeAndParseInt((r as any).MLS_Curr_Sqft),
                mls_curr_beds: sanitizeAndParseInt((r as any).MLS_Curr_Beds),
                mls_curr_baths: sanitizeAndParseFloat((r as any).MLS_Curr_Baths),
                mls_curr_garage: (r as any).MLS_Curr_Garage,
                mls_curr_yearbuilt: sanitizeAndParseInt((r as any).MLS_Curr_YearBuilt),
                mls_curr_photos: (r as any).MLS_Curr_Photos
            }));

            batch.push(...sanitizedRows);
            rowCount += sanitizedRows.length;
            
            if (batch.length >= batchSize) {
              const { error } = await supabase.from('staging_contacts_csv').insert(batch.splice(0));
              if (error) return reject(error);
            }
          } catch (err) {
            return reject(err);
          } finally {
            parser.resume();
          }
        },
        complete: async () => {
          try {
            if (batch.length > 0) {
              const { error } = await supabase.from('staging_contacts_csv').insert(batch);
              if (error) return reject(error);
            }
            resolve(rowCount);
          } catch (err) {
            reject(err);
          }
        },
        error: (err: any) => reject(err),
      });
    });

    const [{ error: uploadError }, totalRows] = await Promise.all([
      storageUploadPromise,
      processCsvPromise
    ]);

    if (uploadError) throw uploadError;

    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 75, message: `Staging complete. Starting database import for ${totalRows} rows.` }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_STAGING_COMPLETE',
      message: `${totalRows} rows staged for job ${jobId}. Starting database import RPC.`,
      details: { jobId, totalRows, userId, marketRegion },
      level: 'INFO'
    });

    // STAGE 4: Import from Staging
    const { error: rpcErr } = await supabase.rpc('import_from_staging_csv', {
      p_user_id: userId,
      p_job_id: jobId,
      p_market_region: marketRegion
    });
    if (rpcErr) throw rpcErr;

    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 95, message: 'Database import complete. Finalizing...' }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_DB_IMPORT_COMPLETE',
      message: `Database import RPC finished for job ${jobId}.`,
      details: { jobId, totalRows, userId, marketRegion },
      level: 'INFO'
    });

    // STAGE 5: Finalize
    await supabase.from('file_imports').insert({ file_key: filePath, row_count: totalRows, user_id: userId, job_id: jobId });
    await supabase.from('upload_jobs').update({ status: 'COMPLETE', progress: 100, message: `Import successful! ${totalRows} records processed.` }).eq('job_id', jobId);
    
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_SUCCESS',
      message: `Lead upload job ${jobId} completed successfully.`,
      details: { jobId, fileName, totalRows, userId, marketRegion },
      level: 'INFO'
    });

    await invalidateLeadCaches();

    return NextResponse.json({ ok: true, job_id: jobId, message: 'Import complete' });

  } catch (error: any) {
    const errorMessage = error.message || 'An unknown processing error occurred.';
    console.error(`[LEAD UPLOAD ERROR] Job ID ${jobId || 'N/A'}:`, error);
    
    if (jobId) {
        await supabase.from('upload_jobs')
          .update({
            status: 'FAILED',
            progress: 100,
            message: errorMessage
          })
          .eq('job_id', jobId);
    }
    
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_FAILURE',
      message: `Lead upload job ${jobId || 'N/A'} failed.`,
      details: { jobId, fileName, userId, marketRegion, error: errorMessage, stack: error.stack },
      level: 'ERROR'
    });

    return NextResponse.json(
      { ok: false, message: 'An error occurred during processing.', details: errorMessage },
      { status: 500 }
    );
  }
}