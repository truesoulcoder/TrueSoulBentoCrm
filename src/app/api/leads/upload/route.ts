// src/app/api/leads/upload/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { Readable } from 'stream';
import redis from '@/lib/redis';
import { logSystemEvent } from '@/services/logService'; // Import the logging service

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Set to 50mb as per user requirement
    },
  },
};
// Helper function to clear all relevant lead and region caches from Redis.
async function invalidateLeadCaches() {
  try {
    const leadCacheKeys = await redis.keys('leads:*');
    const regionCacheKeys = await redis.keys('market_regions:*');
    const allKeys = [...leadCacheKeys, ...regionCacheKeys];
    
    if (allKeys.length > 0) {
      console.log('[CACHE INVALIDATION - UPLOAD] Deleting keys:', allKeys);
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

// Helper function to sanitize and parse numeric values that might contain currency symbols or commas
function sanitizeAndParseFloat(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }
  // Remove currency symbols, commas, and any non-numeric characters except the decimal point and negative sign
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
    // Remove anything that isn't a digit or a negative sign at the start
    const sanitizedValue = value.replace(/[^0-9-]+/g, "");
    if (sanitizedValue === '') {
        return null;
    }
    const number = parseInt(sanitizedValue, 10);
    return isNaN(number) ? null : number;
}

// Helper function to format dates for PostgreSQL
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
  const userId = user.id;

  const form = await request.formData();
  const file = form.get('file');
  const jobId = form.get('job_id') as string;
  const marketRegion = form.get('market_region') as string;

    if (!file || typeof file === 'string' || !jobId || !marketRegion) {
      const missingFields = [];
      if (!file || typeof file === 'string') missingFields.push('file');
      if (!jobId) missingFields.push('job_id');
      if (!marketRegion) missingFields.push('market_region');

      await logSystemEvent({
        event_type: 'UPLOAD_VALIDATION_ERROR',
        message: 'Missing required fields for lead upload.',
        details: { jobId, userId, missingFields },
        level: 'ERROR'
      });
      return NextResponse.json({ ok: false, message: 'Missing file, job_id, or market_region' }, { status: 400 });
  }

  try {
    const filePath = `${userId}/${jobId}-${file.name}`;

    // Create initial job record
    await supabase.from('upload_jobs').insert({
      job_id: jobId,
      user_id: userId,
      file_name: file.name,
      status: 'PENDING',
      progress: 5,
      message: 'Initializing upload...'
    });
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_JOB_INIT',
      message: `Upload job ${jobId} initialized for file ${file.name}.`,
      details: { jobId, fileName: file.name, userId, marketRegion },
      level: 'INFO'
    });

    // Check for duplicate file import before uploading
    const { data: dup, error: dupError } = await supabase.from('file_imports').select('file_key').eq('file_key', filePath);
    if (dupError) throw dupError;

    if (dup?.length) {
      await supabase.from('upload_jobs')
        .update({ status: 'FAILED', progress: 100, message: 'This file has already been imported.' })
        .eq('job_id', jobId);
      await logSystemEvent({
        event_type: 'LEAD_UPLOAD_DUPLICATE_FILE',
        message: `Duplicate file detected for job ${jobId}. Aborting upload.`,
        details: { jobId, fileName: file.name, userId, filePath },
        level: 'WARN'
      });
      return NextResponse.json({ ok: false, message: 'Duplicate file' }, { status: 409 });
    }

    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 10, message: 'File received. Starting stream processing.' }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_FILE_RECEIVED',
      message: `File for job ${jobId} received and streaming started.`,
      details: { jobId, fileName: file.name, userId },
      level: 'INFO'
    });

    // Tee the stream to upload to storage and parse CSV simultaneously
    const fileStream = file.stream();
    const [storageStream, csvStream] = fileStream.tee();

    // Start storage upload in the background
    const storageUploadPromise = supabase.storage
      .from('lead-uploads')
      .upload(filePath, storageStream, { 
          contentType: file.type, 
          upsert: false,
          duplex: 'half' // Required for streaming uploads
        });

    // Process the CSV stream and insert into staging table in batches
    const processCsvPromise = new Promise<number>((resolve, reject) => {
      const batch: any[] = [];
      const batchSize = 100;
      let rowCount = 0;
      let processedChunks = 0;
      const totalFileSize = file.size;
      const uploadChunkSize = 1024 * 1024; // 1MB chunks for progress reporting

      Papa.parse(Readable.fromWeb(csvStream as any), {
        header: true,
        skipEmptyLines: true,
        chunk: async (results: { data: Record<string, string>[]; errors: any[] }, parser: { pause: () => void; resume: () => void; }) => {
          parser.pause();
          
          if (results.errors.length > 0) {
            console.error('CSV Parsing errors in chunk:', results.errors);
            reject(new Error(`CSV parsing errors: ${JSON.stringify(results.errors)}`));
            return;
          }

          try {
            for (const r of results.data) {
              const sanitizedRow = {
                property_address: r.PropertyAddress,
                property_city: r.PropertyCity,
                property_state: r.PropertyState,
                property_postal_code: r.PropertyPostalCode,
                property_type: r.PropertyType,
                owner_type: r.OwnerType,
                year_built: sanitizeAndParseInt(r.YearBuilt),
                square_footage: sanitizeAndParseInt(r.SquareFootage),
                lot_size_sqft: sanitizeAndParseFloat(r.LotSizeSqFt),
                baths: sanitizeAndParseFloat(r.Baths),
                beds: sanitizeAndParseInt(r.Beds),
                price_per_sqft: sanitizeAndParseFloat(r.PricePerSqFt),
                assessed_year: sanitizeAndParseInt(r.AssessedYear),
                assessed_total: sanitizeAndParseFloat(r.AssessedTotal),
                market_value: sanitizeAndParseFloat(r.MarketValue),
                wholesale_value: sanitizeAndParseFloat(r.WholesaleValue),
                avm: sanitizeAndParseFloat(r.AVM),
                first_name: r.FirstName,
                last_name: r.LastName,
                recipient_address: r.RecipientAddress,
                recipient_city: r.RecipientCity,
                recipient_state: r.RecipientState,
                recipient_postal_code: r.RecipientPostalCode,
                contact1_name: r.Contact1Name,
                contact1_phone_1: r.Contact1Phone_1,
                contact1_email_1: r.Contact1Email_1,
                contact2_name: r.Contact2Name,
                contact2_phone_1: r.Contact2Phone_1,
                contact2_email_1: r.Contact2Email_1,
                contact3_name: r.Contact3Name,
                contact3_phone_1: r.Contact3Phone_1,
                contact3_email_1: r.Contact3Email_1,
                mls_curr_listingid: r.MLS_Curr_ListingID,
                mls_curr_status: r.MLS_Curr_Status,
                mls_curr_listdate: formatDateForDB(r.MLS_Curr_ListDate),
                mls_curr_solddate: formatDateForDB(r.MLS_Curr_SoldDate),
                mls_curr_daysonmarket: sanitizeAndParseInt(r.MLS_Curr_DaysOnMarket),
                mls_curr_listprice: sanitizeAndParseFloat(r.MLS_Curr_ListPrice),
                mls_curr_saleprice: sanitizeAndParseFloat(r.MLS_Curr_SalePrice),
                mls_curr_listagentname: r.MLS_Curr_ListAgentName,
                mls_curr_listagentphone: r.MLS_Curr_ListAgentPhone,
                mls_curr_listagentemail: r.MLS_Curr_ListAgentEmail,
                mls_curr_pricepersqft: sanitizeAndParseFloat(r.MLS_Curr_PricePerSqft),
                mls_curr_sqft: sanitizeAndParseInt(r.MLS_Curr_Sqft),
                mls_curr_beds: sanitizeAndParseInt(r.MLS_Curr_Beds),
                mls_curr_baths: sanitizeAndParseFloat(r.MLS_Curr_Baths),
                mls_curr_garage: r.MLS_Curr_Garage,
                mls_curr_yearbuilt: sanitizeAndParseInt(r.MLS_Curr_YearBuilt),
                mls_curr_photos: r.MLS_Curr_Photos
              };
              batch.push(sanitizedRow);
              rowCount++;
            }

            if (batch.length >= batchSize) {
              const { error } = await supabase.from('staging_contacts_csv').insert(batch.splice(0, batchSize));
              if (error) throw error;
              processedChunks += batchSize;
              const currentProgress = Math.min(90, 10 + Math.floor((processedChunks / totalRows) * 50)); // Scale to 10-60% for parsing
              await supabase.from('upload_jobs').update({ progress: currentProgress, message: `Parsed ${rowCount} rows...` }).eq('job_id', jobId);
            }
          } catch (err) {
            console.error('Error during CSV chunk processing:', err);
            reject(err);
          } finally {
            parser.resume();
          }
        },
        complete: async () => {
          try {
            if (batch.length > 0) {
              const { error } = await supabase.from('staging_contacts_csv').insert(batch);
              if (error) throw error;
            }
            resolve(rowCount);
          } catch (err) {
            reject(err);
          }
        },
        error: (err: any) => {
          console.error('PapaParse error:', err);
          reject(err);
        },
      });
    });

    // Wait for both streaming operations to complete
    const [totalRows, { error: uploadError }] = await Promise.all([
      processCsvPromise,
      storageUploadPromise,
    ]);

    if (uploadError) throw uploadError;

    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 60, message: `${totalRows} rows staged in database.` }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_STAGING_COMPLETE',
      message: `${totalRows} rows staged for job ${jobId}. Starting database import RPC.`,
      details: { jobId, totalRows, userId },
      level: 'INFO'
    });

    const { error: rpcErr } = await supabase.rpc('import_from_staging_csv', {
      p_user_id: userId,
      p_job_id: jobId,
      p_market_region: marketRegion
    });
    if (rpcErr) throw rpcErr;

    await supabase.from('upload_jobs').update({ status: 'PROCESSING', progress: 90, message: 'Database import complete. Finalizing...' }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_DB_IMPORT_COMPLETE',
      message: `Database import RPC finished for job ${jobId}.`,
      details: { jobId, totalRows, userId, marketRegion },
      level: 'INFO'
    });


    const { error: fileImportError } = await supabase.from('file_imports').insert({ file_key: filePath, row_count: totalRows, user_id: userId, job_id: jobId });
    if (fileImportError) throw fileImportError;

    await supabase.from('upload_jobs').update({ status: 'COMPLETE', progress: 100, message: 'Import successful!' }).eq('job_id', jobId);
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_SUCCESS',
      message: `Lead upload job ${jobId} completed successfully. Total rows: ${totalRows}.`,
      details: { jobId, fileName: file.name, totalRows, userId, marketRegion },
      level: 'INFO'
    });

    await invalidateLeadCaches(); // Invalidate caches after successful import

    return NextResponse.json({ ok: true, job_id: jobId, message: 'Import complete' });

  } catch (error: any) {
    console.error(`[LEAD UPLOAD ERROR] Job ID ${jobId}:`, error);

    const errorMessage = error.message || 'An unknown processing error occurred.';
    await supabase.from('upload_jobs')
      .update({
        status: 'FAILED',
        progress: 100,
        message: errorMessage
      })
      .eq('job_id', jobId);
    
    await logSystemEvent({
      event_type: 'LEAD_UPLOAD_FAILURE',
      message: `Lead upload job ${jobId} failed.`,
      details: { jobId, fileName: file?.name, userId, marketRegion, error: errorMessage },
      level: 'ERROR'
    });

    return NextResponse.json(
      { ok: false, message: 'An error occurred during processing.', details: errorMessage },
      { status: 500 }
    );
  }
}