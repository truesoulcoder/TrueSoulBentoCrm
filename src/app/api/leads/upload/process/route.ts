import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

// Helper: split an array into chunks of n
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const supabase = await createAdminServerClient();

  // 1. Auth
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Validate body
  let body: { jobId?: string; marketRegion?: string };
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { jobId, marketRegion } = body;
  if (!jobId || !marketRegion) {
    return NextResponse.json({ error: 'Missing jobId or marketRegion' }, { status: 400 });
  }

  // 3. Fetch job row to get storage info
  const {
    data: job,
    error: jobErr,
  } = await supabase
    .from('upload_jobs')
    .select('file_name')
    .eq('job_id', jobId)
    .single();
  if (jobErr || !job) {
    return NextResponse.json({ error: 'Upload job not found' }, { status: 400 });
  }

  // assume all CSV uploads go to the fixed bucket 'lead-uploads'
  const bucket = 'lead-uploads';
  const objectPath = `${userId}/${jobId}/${job.file_name}`;

  // 4. Update status → PROCESSING
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 10, message: 'Downloading CSV' })
    .eq('job_id', jobId);

  // 5. Download CSV
  const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(objectPath);
  if (dlError || !fileData) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `Download error: ${dlError?.message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'Failed to download CSV' }, { status: 500 });
  }
  const csvText = await fileData.text();

  // 6. Parse csv
  const { data: parsedRows, errors: parseErrors } = Papa.parse<any>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parseErrors.length) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `CSV parse errors: ${parseErrors[0].message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'CSV parse error', details: parseErrors }, { status: 500 });
  }

  // 7. Stage rows in chunks
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 30, message: 'Inserting into staging table' })
    .eq('job_id', jobId);

  // Prepare list of valid columns in staging_contacts_csv
  const validCols = new Set([
    'first_name', 'last_name', 'recipient_address', 'recipient_city', 'recipient_state', 'recipient_postal_code',
    'owner_type', 'property_address', 'property_city', 'property_state', 'property_postal_code', 'property_type',
    'year_built', 'square_footage', 'lot_size_sqft', 'baths', 'beds', 'price_per_sqft',
    'assessed_year', 'assessed_total', 'market_value', 'wholesale_value', 'avm',
    'contact1_name', 'contact1_phone_1', 'contact1_email_1', 'contact1_email_2', 'contact1_email_3',
    'contact2_name', 'contact2_phone_1', 'contact2_email_1', 'contact2_email_2', 'contact2_email_3',
    'contact3_name', 'contact3_phone_1', 'contact3_email_1', 'contact3_email_2', 'contact3_email_3',
    'mls_curr_listingid', 'mls_curr_status', 'mls_curr_listdate', 'mls_curr_solddate', 'mls_curr_daysonmarket',
    'mls_curr_listprice', 'mls_curr_saleprice', 'mls_curr_listagentname', 'mls_curr_listagentphone', 'mls_curr_listagentemail',
    'mls_curr_pricepersqft', 'mls_curr_sqft', 'mls_curr_beds', 'mls_curr_baths', 'mls_curr_garage', 'mls_curr_yearbuilt', 'mls_curr_photos'
  ]);

  const normalizeKey = (k: string) =>
    k
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase -> camel_Case
      .replace(/\s+/g, '_') // spaces -> _
      .replace(/[^a-zA-Z0-9_]/g, '') // remove non-alphanum
      .toLowerCase();

  const integerCols = new Set(['year_built','square_footage','beds','assessed_year','lot_size_sqft','price_per_sqft','mls_curr_daysonmarket','mls_curr_sqft','mls_curr_beds','mls_curr_yearbuilt','mls_curr_listprice']);
  const numericCols = new Set([
    'assessed_total','market_value','wholesale_value','avm','price_per_sqft','mls_curr_listprice','mls_curr_saleprice','mls_curr_pricepersqft'
  ]);

  // Map common vendor header variants to our canonical column names
  const aliasMap: Record<string, string> = {
    lotsize_sqft: 'lot_size_sqft',
    pricepersqft: 'price_per_sqft',
    price_per_sqft_: 'price_per_sqft',
    beds_: 'beds',
    baths_: 'baths',
    yearbuilt: 'year_built',
    assessedtotal: 'assessed_total',
    marketvalue: 'market_value',
    wholesalevalue: 'wholesale_value',
    mls_curr_listingid_: 'mls_curr_listingid',
    mls_curr_listprice_: 'mls_curr_listprice',
    mls_list_price: 'mls_curr_listprice',
    mls_days_on_market: 'mls_curr_daysonmarket',
    mls_curr_saleprice_: 'mls_curr_saleprice',
    // newly observed variants after header normalization
    lotsizesqft: 'lot_size_sqft',
    mlscurrlistprice: 'mls_curr_listprice',
    listprice: 'mls_curr_listprice',
    listingprice: 'mls_curr_listprice',
    // variants with inserted underscores
    lot_size_sq_ft: 'lot_size_sqft',
    mls_curr_list_price: 'mls_curr_listprice',
    mls_curr_sale_price: 'mls_curr_saleprice',
    mls_curr_price_per_sqft: 'mls_curr_pricepersqft',
    mls_curr_days_on_market: 'mls_curr_daysonmarket',
    // extend as needed
      // MLS variants with word-separating underscores
    mls_curr_listing_id: 'mls_curr_listingid',
    mls_curr_list_date: 'mls_curr_listdate',
    mls_curr_sold_date: 'mls_curr_solddate',
    mls_curr_year_built: 'mls_curr_yearbuilt',
  };

  const cleanedRows = (parsedRows as Record<string, any>[]).map((row) => {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const nk = normalizeKey(key);
      let col = nk;
      if (!validCols.has(col) && aliasMap[col]) {
        col = aliasMap[col];
      }
      if (validCols.has(col)) {
        const raw = typeof value === 'string' ? value.trim() : value;
        if (typeof raw === 'string' && (raw === '' || ['n/a','na','null','--'].includes(raw.toLowerCase()))) {
          out[col] = null;
        } else if (integerCols.has(col) && typeof raw === 'string') {
          const cleanedVal = raw.replace(/[^0-9]/g, '');
          out[col] = cleanedVal === '' ? null : parseInt(cleanedVal, 10);
        } else if (numericCols.has(col) && typeof raw === 'string') {
          const cleanedVal = raw.replace(/[^0-9.]/g, ''); // keep digits and dot
          out[col] = cleanedVal === '' ? null : cleanedVal;
        } else {
          out[col] = raw;
        }
      }
    }

    // In dev, warn about any unmapped columns so we can extend aliasMap
    if (process.env.NODE_ENV === 'development') {
      for (const origKey of Object.keys(row)) {
        const nk = normalizeKey(origKey);
        if (!validCols.has(nk) && !aliasMap[nk]) {
          // eslint-disable-next-line no-console
          console.warn(`Unmapped CSV column: ${origKey} -> ${nk}`);
        }
      }
    }

    return out;
  });

  const chunks = chunkArray(cleanedRows, 1000);
  for (let i = 0; i < chunks.length; i++) {
    const { error: insErr } = await supabase
      .from('staging_contacts_csv')
      .insert(chunks[i], { defaultToNull: true });
    if (insErr) {
      await supabase
        .from('upload_jobs')
        .update({ status: 'FAILED', message: `Staging insert error: ${insErr.message}` })
        .eq('job_id', jobId);
      return NextResponse.json({ error: 'Staging insert error', details: insErr.message }, { status: 500 });
    }
    const progress = 30 + Math.round(((i + 1) / chunks.length) * 40); // up to 70
    await supabase
      .from('upload_jobs')
      .update({ progress })
      .eq('job_id', jobId);
  }

  // 8. Call RPC to import
  await supabase
    .from('upload_jobs')
    .update({ status: 'PROCESSING', progress: 75, message: 'Running final import' })
    .eq('job_id', jobId);

  const { error: rpcErr } = await supabase.rpc('import_leads_from_staging', {
    p_job_id: jobId,
    p_user_id: userId,
    p_market_region: marketRegion,
  });
  if (rpcErr) {
    await supabase
      .from('upload_jobs')
      .update({ status: 'FAILED', message: `Import error: ${rpcErr.message}` })
      .eq('job_id', jobId);
    return NextResponse.json({ error: 'Import failed', details: rpcErr.message }, { status: 500 });
  }

  // 9. Success
  await supabase
    .from('upload_jobs')
    .update({ status: 'COMPLETE', progress: 100, message: 'Import completed successfully' })
    .eq('job_id', jobId);

  return NextResponse.json({ message: 'Import completed successfully' });
}